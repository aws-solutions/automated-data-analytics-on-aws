/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  DynamicInfraDeploymentPermissionsBoundaryPolicyStatement,
  DynamicInfraDeploymentPolicyStatement,
  TypescriptFunction,
} from '@ada/infra-common';
import { Effect, ManagedPolicy, PermissionsBoundary, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
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
import { TearDownDetails } from './types';
import { TeardownEnvironmentVars } from './handlers/types';
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
}

/**
 * Administration service api
 */
export default class AdministrationApi extends MicroserviceApi {
  readonly startTearDownRetainDataLambda: TypescriptFunction;
  readonly startTearDownDestroyDataLambda: TypescriptFunction;
  readonly tearDownLambda: TypescriptFunction;

  constructor(scope: Construct, id: string, props: AdministrationApiProps) {
    super(scope, id, props);

    const { coreStack, counterTable, internalTokenKey, entityManagementTables, federatedApi, notificationBus } = props;

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
      },
    });
  }
}
