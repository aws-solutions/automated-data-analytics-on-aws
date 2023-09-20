/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccountPrincipal,
  CompositePrincipal,
  Effect,
  IRole,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { AthenaGetQueryExecution, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { AthenaQueryExecutionState } from '@ada/common';
import { CfnResource, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  Choice,
  Condition,
  DefinitionBody,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { CounterTable } from '../../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../../api/components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../../common/constructs/api/federated-api';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { InternalTokenKey } from '../../../../common/constructs/kms/internal-token-key';
import { JSON_PATH_AT } from '../../../data-product/dynamic-infrastructure/types';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { MicroserviceApi } from '@ada/infra-common/services';
import { OperationalMetricsConfig, TypescriptFunction } from '@ada/infra-common';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { addCfnNagSuppressions, getUniqueStateMachineLogGroupName } from '@ada/cdk-core';
import { configOperationalMetricsClientForLambda } from '../../../api/components/operational-metrics/client';

export interface AthenaQueryExecutorStateMachineProps {
  counterTable: CounterTable;
  athenaOutputBucket: IBucket;
  executeAthenaQueryLambdaRoleArn: string;
  // If not specified, assume the query is already generated and skip
  queryGenerateLambda?: TypescriptFunction;
  cachedQueryTable: Table;
  federatedApi: FederatedRestApi;
  dataProductApiBasePath: string;
  queryParseRenderApi: MicroserviceApi;
  governanceApi: MicroserviceApi;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
  glueKmsKey: Key;
  queryEventsStream?: Stream;
  operationalMetricsConfig: OperationalMetricsConfig;
}

/**
 * Construct to create a state machine to be used to execute queries in athena
 */
export class AthenaQueryExecutorStateMachine extends Construct {
  public readonly stateMachine: StateMachine;

  private getAthenaAccessPolicyStatement(): PolicyStatement {
    return new PolicyStatement({
      actions: [
        'athena:StartQueryExecution',
        'athena:StopQueryExecution',
        'athena:GetQueryExecution',
        'athena:GetQueryResults',
      ],
      resources: ['*'],
      effect: Effect.ALLOW,
    });
  }

  private getGluePolicyStatement(): PolicyStatement {
    return new PolicyStatement({
      actions: [
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:CreateTable',
        'glue:DeleteTable',
        'glue:BatchDeleteTable',
        'glue:UpdateTable',
        'glue:GetTable',
        'glue:GetTables',
        'glue:BatchCreatePartition',
        'glue:CreatePartition',
        'glue:DeletePartition',
        'glue:BatchDeletePartition',
        'glue:UpdatePartition',
        'glue:GetPartition',
        'glue:GetPartitions',
        'glue:BatchGetPartition',
      ],
      resources: ['*'],
      effect: Effect.ALLOW,
    });
  }

  private getCloudWatchPolicyStatement(): PolicyStatement {
    return new PolicyStatement({
      actions: ['cloudwatch:PutMetricAlarm', 'cloudwatch:DescribeAlarms', 'cloudwatch:DeleteAlarms'],
      resources: ['*'],
      effect: Effect.ALLOW,
    });
  }

  private getKmsPolicyStatement(kmsKey: Key): PolicyStatement {
    return new PolicyStatement({
      actions: ['kms:Decrypt'],
      resources: [kmsKey.keyArn],
      effect: Effect.ALLOW,
    });
  }

  constructor(scope: Construct, id: string, props: AthenaQueryExecutorStateMachineProps) {
    super(scope, id);

    const {
      athenaOutputBucket,
      executeAthenaQueryLambdaRoleArn,
      queryGenerateLambda,
      counterTable,
      glueKmsKey,
      queryEventsStream,
    } = props;

    const executeAthenaQueryLambdaRole = Role.fromRoleArn(
      this,
      'QueryExecutionStateMachineExecuteAthenaQueryLambdaRole',
      executeAthenaQueryLambdaRoleArn,
    );
    const executeAthenaQueryPolicy = new Policy(this, 'AthenaExecutionPolicy', {
      document: new PolicyDocument({
        statements: [
          this.getAthenaAccessPolicyStatement(),
          this.getGluePolicyStatement(),
          this.getCloudWatchPolicyStatement(),
          this.getKmsPolicyStatement(glueKmsKey),
        ],
      }),
    });

    executeAthenaQueryLambdaRole.attachInlinePolicy(executeAthenaQueryPolicy);
    glueKmsKey.grantDecrypt(executeAthenaQueryLambdaRole);

    [
      executeAthenaQueryPolicy.node.defaultChild,
      ...(executeAthenaQueryLambdaRole.node.tryFindChild('Policy')
        ? [executeAthenaQueryLambdaRole.node.findChild('Policy').node.defaultChild]
        : []),
    ].forEach((resource) =>
      addCfnNagSuppressions(resource as CfnResource, [
        {
          id: 'W12',
          reason: 'Athena query access requires * resource',
        },
        {
          id: 'W76',
          reason: 'SPCM expected to be high for query execution role since it interacts with many resources',
        },
      ]),
    );

    const buildLambda = (handlerFile: string, role?: IRole) => {
      return new TypescriptFunction(this, `AthenaQueryExecutor-${handlerFile}`, {
        package: 'query-service',
        handlerFile: require.resolve(`./steps/${handlerFile}`),
        environment: {
          ATHENA_OUTPUT_BUCKET_NAME: athenaOutputBucket.bucketName,
          CACHED_QUERY_TABLE_NAME: props.cachedQueryTable.tableName,
          ...(queryGenerateLambda ? { GENERATE_QUERY_FUNCTION_ARN: queryGenerateLambda.functionArn } : {}),
          ATHENA_EXECUTE_QUERY_ROLE_ARN: executeAthenaQueryLambdaRoleArn,
        },
        // https://github.com/aws/aws-cdk/issues/1506
        role: role as any,
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
      });
    };

    // NOTE: consider adding persistent notifications
    const notifySuccess = new Pass(this, 'NotifySuccess');
    const notifyError = new Pass(this, 'NotifyError');

    const putCachedQueryLambda = buildLambda('put-cached-query');
    props.cachedQueryTable.grantReadWriteData(putCachedQueryLambda);

    const writeInCache = new LambdaInvoke(this, 'WriteInCache', {
      lambdaFunction: putCachedQueryLambda,
      payloadResponseOnly: true,
      payload: TaskInput.fromObject({
        Payload: TaskInput.fromJsonPathAt('$').value,
      }),
    });

    // Create a step to generate the query if specified
    let generateQuery, putQueryEventsStream: LambdaInvoke;
    if (queryGenerateLambda) {
      const invokeGenerateQueryLambda = buildLambda('invoke-generate-query');
      queryGenerateLambda.grantInvoke(invokeGenerateQueryLambda);

      generateQuery = new LambdaInvoke(this, 'GenerateQuery', {
        lambdaFunction: invokeGenerateQueryLambda,
        payloadResponseOnly: true,
        payload: TaskInput.fromObject({
          Payload: TaskInput.fromJsonPathAt('$').value,
        }),
      }).addCatch(notifyError);
    }

    const getCachedQueryLambda = buildLambda('get-cached-query');
    props.cachedQueryTable.grantReadData(getCachedQueryLambda);

    const getCachedQuery = new LambdaInvoke(this, 'GetCachedQuery', {
      lambdaFunction: getCachedQueryLambda,
      payloadResponseOnly: true,
      payload: TaskInput.fromObject({
        Payload: TaskInput.fromJsonPathAt('$').value,
      }),
    });

    const executeAthenaQueryLambda = buildLambda('start-athena-query-execution', executeAthenaQueryLambdaRole);
    athenaOutputBucket.grantReadWrite(executeAthenaQueryLambda);
    executeAthenaQueryLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: [executeAthenaQueryLambdaRoleArn],
      }),
    );

    const executeAthenaQuery = new LambdaInvoke(this, 'RunQueryOnAthena', {
      lambdaFunction: executeAthenaQueryLambda,
      payloadResponseOnly: true,
      payload: TaskInput.fromObject({
        Payload: TaskInput.fromJsonPathAt('$').value,
      }),
    }).addCatch(notifyError);

    const getAthenaQueryStatus = new AthenaGetQueryExecution(this, 'GetAthenaQueryStatus', {
      queryExecutionId: TaskInput.fromJsonPathAt('$.queryExecutionId').value,
      resultPath: '$.athenaStatus',
    }).addCatch(notifyError);

    const waitOneSecond = new Wait(this, 'Wait1Second', {
      time: WaitTime.duration(Duration.seconds(1)),
    });

    if (queryEventsStream) {
      const logQueryExecutionLambdaRole = new Role(this, 'LogQueryEventLambdaRole', {
        assumedBy: new CompositePrincipal(
          new AccountPrincipal(Stack.of(this).account),
          new ServicePrincipal('lambda.amazonaws.com'),
        ),
        description: 'Role created to be assumed by log query event Lambda',
      });

      logQueryExecutionLambdaRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'kinesis:Describe*',
            'kinesis:SubscribeToShard',
            'kinesis:RegisterStreamConsumer',
            'kinesis:GetShardIterator',
            'kinesis:GetRecords',
            'kinesis:ListShards',
            'kinesis:PutRecord*',
          ],
          resources: [queryEventsStream.streamArn],
        }),
      );

      if (queryEventsStream.encryptionKey) {
        logQueryExecutionLambdaRole.addToPolicy(
          new PolicyStatement({
            actions: ['kms:Encrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*'],
            resources: [queryEventsStream.encryptionKey.keyArn],
          }),
        );
      }

      logQueryExecutionLambdaRole.addToPolicy(
        new PolicyStatement({
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams'],
          resources: ['arn:aws:logs:*:*:*'],
        }),
      );

      const logQueryExecutionLambda = new TypescriptFunction(this, `AthenaQuery-log-query-execution`, {
        package: 'query-service',
        handlerFile: require.resolve(`./steps/log-query-execution`),
        environment: {
          KINESIS_STREAM_NAME: queryEventsStream.streamName,
        },
        role: logQueryExecutionLambdaRole,
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
      });

      configOperationalMetricsClientForLambda(logQueryExecutionLambda, props.operationalMetricsConfig);

      putQueryEventsStream = new LambdaInvoke(this, 'LogQueryExecution', {
        lambdaFunction: logQueryExecutionLambda,
        payloadResponseOnly: true,
        payload: TaskInput.fromObject({
          Payload: TaskInput.fromJsonPathAt('$').value,
          Execution: TaskInput.fromJsonPathAt('$$.Execution').value,
        }),
      });
    }

    // Start by generating the query if specified, otherwise start by executing the query
    const initialStep = generateQuery ? generateQuery.next(getCachedQuery) : getCachedQuery;

    const definition = initialStep.next(
      new Choice(this, 'IsItemInCache?')
        .when(Condition.booleanEquals('$.expired', false), notifySuccess)
        .otherwise(
          executeAthenaQuery.next(
            waitOneSecond.next(
              getAthenaQueryStatus.next(
                new Choice(this, 'IsInFinalState?')
                  .when(
                    Condition.stringEquals(
                      JSON_PATH_AT.ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE,
                      AthenaQueryExecutionState.SUCCEEDED,
                    ),
                    writeInCache.next(notifySuccess),
                  )
                  .when(
                    Condition.stringEquals(
                      JSON_PATH_AT.ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE,
                      AthenaQueryExecutionState.FAILED,
                    ),
                    notifyError,
                  )
                  .when(
                    Condition.stringEquals(
                      JSON_PATH_AT.ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE,
                      AthenaQueryExecutionState.CANCELLED,
                    ),
                    notifyError,
                  )
                  .otherwise(waitOneSecond),
              ),
            ),
          ),
        ),
    );

    if (queryEventsStream) {
      notifySuccess.next(putQueryEventsStream!);
      notifyError.next(putQueryEventsStream!);
    }

    this.stateMachine = new StateMachine(this, 'AthenaQueryExecutorStateMachine', {
      tracingEnabled: true,
      definitionBody: DefinitionBody.fromChainable(definition),
      logs: {
        destination: new LogGroup(this, 'AthenaQueryExecutorLogs', {
          logGroupName: getUniqueStateMachineLogGroupName(this, `${id}StateMachineLogs`),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }
}

export default AthenaQueryExecutorStateMachine;
