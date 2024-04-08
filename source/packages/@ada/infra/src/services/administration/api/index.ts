/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Aws, Duration, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Budget, BudgetDetails, BudgetResponse, SupersetDeployResponse, TearDownDetails } from './types';
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import {
  DynamicInfraDeploymentPermissionsBoundaryPolicyStatement,
  DynamicInfraDeploymentPolicyStatement,
  TypescriptFunction,
} from '@ada/infra-common';
import { Effect, ManagedPolicy, PermissionsBoundary, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { IAM_MODIFY_BUDGET, IAM_VIEW_BUDGET } from '../constant';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { NotificationBus } from '../../api/components/notification/constructs/bus';
import {
  RETAINED_RESOURCES_ENV_VAR,
  RetainedAspect,
  addCfnNagSuppressionsToRolePolicy,
  setCfnNagSuppressionForCDKPermsionBoundaryPolicy,
} from '@ada/cdk-core';
import { ResponseProps } from '@ada/infra-common/constructs/api';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { TeardownEnvironmentVars } from './handlers/types';
import { asInput } from '../../../common/constructs/api';
import { getBudgetName } from '../constant';
import DataProductCreationStateMachine from '../../data-product/components/creation-state-machine';

export interface AdministrationApiProps extends MicroserviceApiProps {
  counterTable: CounterTable;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
  dataProductCreationStateMachine: DataProductCreationStateMachine;
  dataProductTable: Table;
  dataBuckets: Bucket[];
  notificationBus: NotificationBus;
  coreStack: Stack;
  visualisationDeploymentCodeBuildProjectName: string;
}

/**
 * Administration service api
 */
export default class AdministrationApi extends MicroserviceApi {
  readonly startTearDownRetainDataLambda: TypescriptFunction;
  readonly startTearDownDestroyDataLambda: TypescriptFunction;
  readonly tearDownLambda: TypescriptFunction;
  readonly getBudgetLambda: TypescriptFunction;
  readonly postBudgetLambda: TypescriptFunction;
  readonly deleteBudgetLambda: TypescriptFunction;
  readonly deploySupersetLambda: TypescriptFunction;

  constructor(scope: Construct, id: string, props: AdministrationApiProps) {
    super(scope, id, props);

    const {
      coreStack,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      federatedApi,
      notificationBus,
      visualisationDeploymentCodeBuildProjectName,
    } = props;

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string, timeout?: Duration) => {
      const lambda = new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          DATA_PRODUCT_TABLE_NAME: props.dataProductTable.tableName,
          CORE_STACK_ID: coreStack.stackId,
          CORE_STACK_NAME: coreStack.stackName,
        } as Omit<TeardownEnvironmentVars, typeof RETAINED_RESOURCES_ENV_VAR | 'TEAR_DOWN_LAMBDA_ARN'>,
        apiLayer: {
          endpoint: federatedApi.url,
        },
        timeout,
        counterTable,
        internalTokenKey,
        entityManagementTables,
        notificationBus,
      });

      // Grant lambda delete permissions on retained resources and
      // add env var containing list of retained resource arns.
      RetainedAspect.of(this).bindLambda(lambda);

      return lambda;
    };

    // Tear down lambda has a 15min timeout in case triggering deletion takes longer than the 30s apigateway timeout
    // (runtime will scale with the number of data products)
    this.tearDownLambda = buildLambda('tear-down', Duration.minutes(15));

    // Grant read to scan the data product table so we can tear down all data product stacks
    props.dataProductTable.grantReadData(this.tearDownLambda);

    // Grant access to delete data product stacks, and the core stack
    this.tearDownLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudformation:DeleteStack', 'cloudformation:DescribeStacks'],
        resources: [...props.dataProductCreationStateMachine.cloudformationResourceArns, coreStack.stackId],
      }),
    );

    this.tearDownLambda.addToRolePolicy(DynamicInfraDeploymentPolicyStatement);

    // Create a permissions boundary to avoid potential privilege escalation since the tear down lambda has full iam permissions
    const tearDownPermissionsBoundary = new ManagedPolicy(this, 'TearDownPermissionsBoundary', {
      statements: [DynamicInfraDeploymentPermissionsBoundaryPolicyStatement],
    });
    PermissionsBoundary.of(this.tearDownLambda.role!).apply(tearDownPermissionsBoundary);

    setCfnNagSuppressionForCDKPermsionBoundaryPolicy(tearDownPermissionsBoundary);

    const NAG_REASON = 'Used to tear down the CloudFormation stack';

    addCfnNagSuppressionsToRolePolicy(this.tearDownLambda.role!, [
      { id: 'F4', reason: NAG_REASON },
      { id: 'F39', reason: NAG_REASON },
      { id: 'W12', reason: NAG_REASON },
      { id: 'W76', reason: 'SPCM expected to be high for CloudFormation execution role' },
    ]);

    this.startTearDownRetainDataLambda = buildLambda('start-tear-down-retain-data');
    this.startTearDownDestroyDataLambda = buildLambda('start-tear-down-destroy-data');
    [this.startTearDownRetainDataLambda, this.startTearDownDestroyDataLambda].forEach((lambda) => {
      this.tearDownLambda.grantInvoke(lambda);
      lambda.addEnvironment('TEAR_DOWN_LAMBDA_ARN', this.tearDownLambda.functionArn);
    });

    const budgetName = getBudgetName(Stack.of(this).region);
    const budgetArn = `arn:${Stack.of(this).partition}:budgets::${Stack.of(this).account}:budget/${budgetName}`;

    this.getBudgetLambda = buildLambda('get-budget');
    this.getBudgetLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [IAM_VIEW_BUDGET],
        resources: [budgetArn],
      }),
    );

    this.postBudgetLambda = buildLambda('post-budget');
    this.postBudgetLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [IAM_VIEW_BUDGET, IAM_MODIFY_BUDGET],
        resources: [budgetArn],
      }),
    );

    this.deleteBudgetLambda = buildLambda('delete-budget');
    this.deleteBudgetLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [IAM_VIEW_BUDGET, IAM_MODIFY_BUDGET],
        resources: [budgetArn],
      }),
    );

    this.deploySupersetLambda = buildLambda('deploy-superset');
    this.deploySupersetLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['codebuild:StartBuild', 'codebuild:RetryBuild', 'codebuild:ListBuilds'],
        resources: [
          `arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/${visualisationDeploymentCodeBuildProjectName}`,
        ],
      }),
    );
    this.deploySupersetLambda.addEnvironment(
      'DEPLOYMENT_CODEBUILD_PROJECT_NAME',
      visualisationDeploymentCodeBuildProjectName,
    );

    this.addRoutes();
  }

  private addRoutes() {
    const tearDownResponse = (name: string): ResponseProps => ({
      name,
      description: 'Details about the tear down that has been started',
      schema: TearDownDetails,
      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
    });

    this.api.addRoutes({
      paths: {
        'deploy-superset': {
          POST: {
            integration: new LambdaIntegration(this.deploySupersetLambda),
            response: {
              name: 'PostDeploySupersetOutput',
              description: 'Information about the Apache Superset deployment action',
              schema: SupersetDeployResponse,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
        },
        'start-tear-down': {
          paths: {
            'retain-data': {
              DELETE: {
                integration: new LambdaIntegration(this.startTearDownRetainDataLambda),
                response: tearDownResponse('StartTearDownRetainDataOutput'),
              },
            },
            'destroy-data': {
              DELETE: {
                integration: new LambdaIntegration(this.startTearDownDestroyDataLambda),
                response: tearDownResponse('StartTearDownDestroyDataOutput'),
              },
            },
          },
        },
        budgets: {
          GET: {
            integration: new LambdaIntegration(this.getBudgetLambda),
            response: {
              name: 'GetBudgetOutput',
              description: 'Information about the Budget action',
              schema: BudgetDetails,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
          POST: {
            integration: new LambdaIntegration(this.postBudgetLambda),
            request: {
              name: 'PostBudgetInput',
              description: 'Create new/Update existing budget with notification and subscribers',
              schema: asInput(Budget, ['budgetLimit', 'subscriberList', 'softNotifications']),
            },
            response: {
              name: 'PostBudgetOutput',
              description: 'Information about the Budget creation/update action',
              schema: BudgetResponse,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
          DELETE: {
            integration: new LambdaIntegration(this.deleteBudgetLambda),
            response: {
              name: 'DeleteBudgetOutput',
              description: 'Information about the Budget deletion action',
              schema: BudgetResponse,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
        },
      },
    });
  }
}
