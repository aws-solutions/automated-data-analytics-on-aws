/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaLayer } from '@ada/infra-common/constructs/api/lambda-layer';
import {
  CatchProps,
  Choice,
  Condition,
  DefinitionBody,
  LogLevel,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { CfnPolicy, Effect, ManagedPolicy, PermissionsBoundary, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CounterTable } from '@ada/infra-common/constructs/dynamodb/counter-table';
import { DATA_PRODUCT_CLOUD_FORMATION_STACK_NAME_PREFIX } from '@ada/common';
import { DockerImageFunction, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  DynamicInfraDeploymentPermissionsBoundaryPolicyStatement,
  DynamicInfraDeploymentPolicyStatement,
  OperationalMetricsConfig,
  SolutionIntegrationTypescriptFunctionProps,
  TypescriptFunction,
  TypescriptFunctionProps,
  getDockerImagePath,
} from '@ada/infra-common';
import { EntityManagementTables } from '../../../api/components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '@ada/infra-common/constructs/api';
import { InternalTokenKey } from '../../../../common/constructs/kms/internal-token-key';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { NotificationBus } from '../../../api/components/notification/constructs/bus';
import { TarballImageAsset } from '@ada/infra-common/constructs/ecr-assets/tarball-image-asset';
import { getUniqueStateMachineLogGroupName, setCfnNagSuppressionForCDKPermsionBoundaryPolicy } from '@ada/cdk-core';
import { startCase } from 'lodash';

export interface DataProductCreationStateMachineProps {
  counterTable: CounterTable;
  notificationBus: NotificationBus;
  glueCrawlerStateMachine: StateMachine;
  federatedApi: FederatedRestApi;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
  operationalMetricsConfig: OperationalMetricsConfig;
}

/**
 * Defines the step function state machine used to create data products
 */
export class DataProductCreationStateMachine extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly stepLambdas: LambdaFunction[] = [];

  public readonly cloudformationResourceArns: string[];

  constructor(scope: Construct, id: string, props: DataProductCreationStateMachineProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Data product stacks begin with a common prefix
    const dataProductStackArnPrefix = stack.formatArn({
      service: 'cloudformation',
      resource: 'stack',
      resourceName: `${DATA_PRODUCT_CLOUD_FORMATION_STACK_NAME_PREFIX}*`,
    });
    // CDK cloudformation stacks
    const cdkToolkitStackArnPrefix = stack.formatArn({
      service: 'cloudformation',
      resource: 'stack',
      resourceName: 'CDKToolkit/*',
    });
    this.cloudformationResourceArns = [dataProductStackArnPrefix, cdkToolkitStackArnPrefix];

    const solutionIntegrationProps: SolutionIntegrationTypescriptFunctionProps = {
      notificationBus: props.notificationBus,
      counterTable: props.counterTable,
      internalTokenKey: props.internalTokenKey,
      entityManagementTables: props.entityManagementTables,
    };

    const buildLambda = (
      handlerFile: string,
      TsFunction: new (...args: any[]) => TypescriptFunction = TypescriptFunction,
      memorySize?: number,
      timeout?: Duration,
    ) => {
      const lambda = new TsFunction(this, `Lambda-${handlerFile}`, {
        package: 'data-product-service',
        handlerFile: require.resolve(`./steps/${handlerFile}`),
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        memorySize,
        timeout: timeout || Duration.seconds(60),
        ...solutionIntegrationProps,
      } as TypescriptFunctionProps);
      this.stepLambdas.push(lambda);

      // Grant read access to the appropriate cloudformation stacks to all state machine lambdas
      lambda.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['cloudformation:Describe*', 'cloudformation:List*'],
          resources: this.cloudformationResourceArns,
        }),
      );
      return lambda;
    };

    // The start-data-product-infra-deployment lambda is responsible for synthesizing the dynamic infrastructure and
    // initiating the deployment, so we grant additional write permissions
    const START_DATA_PRODUCT_INFRA_DEPLOYMENT = 'start-data-product-infra-deployment';
    const startDataProductInfraDeploymentImage = new TarballImageAsset(
      this,
      `${startCase(START_DATA_PRODUCT_INFRA_DEPLOYMENT)}Image`,
      {
        tarballFile: getDockerImagePath(START_DATA_PRODUCT_INFRA_DEPLOYMENT),
      },
    );
    const startDataProductInfraDeploymentLambda = new DockerImageFunction(
      this,
      `Lambda-${START_DATA_PRODUCT_INFRA_DEPLOYMENT}`,
      {
        code: TarballImageAsset.tarballImageCode(startDataProductInfraDeploymentImage),
        description:
          'DockerImageLambda with AWS CDK lib to synthesize and depoloy data product dynamic infrastructure.',
        environment: {
          // In cdk upgrade we need concrete env for event rules
          // https://github.com/aws/aws-cdk/blob/5bad3aaac6cc7cc7befb8bdd320181a7c650f15d/packages/%40aws-cdk/aws-events/lib/rule.ts#L202
          CDK_DEPLOY_ACCOUNT: stack.account,
          CDK_DEPLOY_REGION: stack.region,
          // Disable cdk version check, which requires permissions on cdk toolkit resources
          CDK_DISABLE_VERSION_CHECK: '1',
        },
        memorySize: 1024,
        timeout: Duration.minutes(5),
      },
    );
    this.stepLambdas.push(startDataProductInfraDeploymentLambda);
    TypescriptFunction.applySolutionIntegration(startDataProductInfraDeploymentLambda, solutionIntegrationProps);
    // Add api lambda layer along with env and permissions mapping
    ApiLambdaLayer.of(this).applyEnvironment(startDataProductInfraDeploymentLambda, props.federatedApi.url);

    startDataProductInfraDeploymentLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'cloudformation:Describe*',
          'cloudformation:List*',
          'cloudformation:CreateStack',
          'cloudformation:CreateChangeSet',
          'cloudformation:ExecuteChangeSet',
        ],
        resources: this.cloudformationResourceArns,
      }),
    );

    // Grant access to cdk toolkit resources
    // - cdk toolkit parameters and roles
    startDataProductInfraDeploymentLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter', 'iam:PassRole', 'sts:AssumeRole'],
        resources: [
          stack.formatArn({ service: 'iam', region: '', resource: 'role', resourceName: 'cdk-*' }),
          stack.formatArn({ service: 'ssm', resource: 'parameter', resourceName: 'cdk-bootstrap/*' }),
        ],
      }),
    );
    // - cdk toolkit s3 asset publishing bucket (restrict to account via condition since arn can't have account)
    startDataProductInfraDeploymentLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:*Object', 's3:ListBucket', 's3:getBucketLocation'],
        resources: [stack.formatArn({ service: 's3', account: '', region: '', resource: 'cdk-*' })],
        conditions: {
          StringEquals: {
            's3:ResourceAccount': stack.account,
          },
        },
      }),
    );

    startDataProductInfraDeploymentLambda.addToRolePolicy(DynamicInfraDeploymentPolicyStatement);

    // Use a permissions boundary to avoid privilage escalation since full iam permissions are granted to the infra deployment role
    const startDataProductInfraDeploymentPermissionsBoundary = new ManagedPolicy(
      startDataProductInfraDeploymentLambda.role!.node.scope as Construct,
      `${id}-InfraDeploymentPermissionsBoundary`,
      {
        statements: [DynamicInfraDeploymentPermissionsBoundaryPolicyStatement],
      },
    );
    PermissionsBoundary.of(startDataProductInfraDeploymentLambda.role!).apply(
      startDataProductInfraDeploymentPermissionsBoundary,
    );

    setCfnNagSuppressionForCDKPermsionBoundaryPolicy(startDataProductInfraDeploymentPermissionsBoundary);

    (
      startDataProductInfraDeploymentLambda.role!.node.findChild('DefaultPolicy').node.defaultChild as CfnPolicy
    ).addMetadata('cfn_nag', {
      rules_to_suppress: [
        { id: 'F4', reason: 'Used to deploy a new CloudFormation stack' },
        { id: 'F39', reason: 'Used to deploy a new CloudFormation stack' },
      ],
    });

    const startDataProductInfraDeployment = new LambdaInvoke(this, 'StartDataProductInfraDeployment', {
      lambdaFunction: startDataProductInfraDeploymentLambda,
    });

    const checkDataProductInfraDeploymentStatusLambda = buildLambda('check-data-product-infra-deployment-status');
    const checkDataProductInfraDeploymentStatus = new LambdaInvoke(this, 'CheckDataProductInfraDeploymentStatus', {
      lambdaFunction: checkDataProductInfraDeploymentStatusLambda,
    });

    const dataProductInfraDeploymentCompleteLambda = buildLambda('data-product-infra-deployment-complete');

    const dataProductInfraDeploymentComplete = new LambdaInvoke(this, 'DataProductInfraDeploymentComplete', {
      lambdaFunction: dataProductInfraDeploymentCompleteLambda,
    });

    const dataProductInfraDeploymentFailedLambda = buildLambda('data-product-infra-deployment-failed');
    const dataProductInfraDeploymentFailed = new LambdaInvoke(this, 'DataProductInfraDeploymentFailed', {
      lambdaFunction: dataProductInfraDeploymentFailedLambda,
      payload: TaskInput.fromObject({
        ErrorDetails: TaskInput.fromJsonPathAt('$.ErrorDetails').value,
        Payload: TaskInput.fromJsonPathAt('$$.Execution.Input.Payload').value,
      }),
    });

    const wait5Seconds = new Wait(this, 'Wait5Seconds', {
      time: WaitTime.duration(Duration.seconds(5)),
    });

    const catchProps: CatchProps = {
      resultPath: '$.ErrorDetails',
    };

    const definition = startDataProductInfraDeployment
      .addCatch(dataProductInfraDeploymentFailed, catchProps)
      .next(
        checkDataProductInfraDeploymentStatus
          .addCatch(dataProductInfraDeploymentFailed, catchProps)
          .next(
            new Choice(this, 'IsDataProductInfraDeploymentComplete?')
              .when(
                Condition.booleanEquals('$.Payload.isDeploymentComplete', true),
                dataProductInfraDeploymentComplete.addCatch(dataProductInfraDeploymentFailed, catchProps),
              )
              .otherwise(wait5Seconds.next(checkDataProductInfraDeploymentStatus)),
          ),
      );

    this.stateMachine = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      timeout: Duration.minutes(30),
      logs: {
        destination: new LogGroup(this, 'StateMachineLogs', {
          logGroupName: getUniqueStateMachineLogGroupName(this, `${id}StateMachineLogs`),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }
}

export default DataProductCreationStateMachine;
