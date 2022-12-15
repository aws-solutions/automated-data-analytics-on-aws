/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AthenaProxyApiRoutes } from '../components/athena-proxy';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Microservice, MicroserviceApi, MicroserviceProps } from '../../../common/services';
import { OperationalMetricsConfig, TypescriptFunction } from '@ada/infra-common';
import { Stream, StreamEncryption } from 'aws-cdk-lib/aws-kinesis';
import { getUniqueKmsKeyAlias } from '@ada/cdk-core';
import AthenaQueryExecutorStateMachine from '../components/athena-query-executor-step-function';
import QueryApi from '../api';
import serviceConfig from '../service-config';
export interface QueryServiceStackProps extends MicroserviceProps {
  executeAthenaQueryLambdaRoleArn: string;
  dataProductApi: MicroserviceApi;
  ontologyApi: MicroserviceApi;
  queryParseRenderApi: MicroserviceApi;
  governanceApi: MicroserviceApi;
  cachedQueryTable: Table;
  glueKmsKey: Key;
  athenaOutputBucket: Bucket;
  accessLogsBucket: Bucket;
  cognitoDomain: string;
  operationalMetricsConfig: OperationalMetricsConfig;
}

/**
 * Query Parse/Render Service Stack
 */
export class QueryServiceStack extends Microservice {
  readonly api: QueryApi;
  public readonly proxyDistributionDomain: string;

  constructor(scope: Construct, id: string, props: QueryServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    const {
      executeAthenaQueryLambdaRoleArn,
      cachedQueryTable,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      glueKmsKey,
      athenaOutputBucket,
      cognitoDomain,
    } = props;

    const queryHistoryTable = new CountedTable(this, 'QueryHistoryTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'createdBy',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'createdTimestamp',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    const savedQueryTableProps = {
      partitionKey: {
        name: 'namespace',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'queryId',
        type: AttributeType.STRING,
      },
    };

    const savedPrivateQueryTable = new CountedTable(this, 'SavedPrivateQueryTable', {
      pointInTimeRecovery: true,
      ...savedQueryTableProps,
      counterTable,
    });
    const savedPublicQueryTable = new CountedTable(this, 'SavedPublicQueryTable', {
      pointInTimeRecovery: true,
      ...savedQueryTableProps,
      counterTable,
    });

    const queryGenerateLambda = new TypescriptFunction(this, `Lambda-generate-query`, {
      package: 'query-service',
      handlerFile: require.resolve('../api/handlers/generate-query'),
      apiLayer: {
        endpoint: props.federatedApi.url,
      },
      environment: {
        CACHED_QUERY_TABLE_NAME: cachedQueryTable.tableName,
      },
      counterTable,
      internalTokenKey,
      entityManagementTables,
    });
    queryGenerateLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          props.queryParseRenderApi.arnForExecuteApi('POST', '/discover', 'prod'),
          props.queryParseRenderApi.arnForExecuteApi('POST', '/rewrite', 'prod'),
          props.dataProductApi.arnForExecuteApi('GET', '/domain/*/data-product/*', 'prod'),
          props.governanceApi.arnForExecuteApi('GET', '/policy/domain/*/data-product/*/permissions', 'prod'),
        ],
      }),
    );
    cachedQueryTable.grantReadWriteData(queryGenerateLambda);

    const queryLogKmsKey = new Key(this, 'AdaQueryLogKmsKey', {
      alias: getUniqueKmsKeyAlias(this, 'query-log'),
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const queryEventsStream = new Stream(this, `QueryEventsStream`, {
      encryption: StreamEncryption.KMS,
      encryptionKey: queryLogKmsKey,
      shardCount: 1,
      retentionPeriod: Duration.days(365),
    });

    const athenaQueryExecutorStateMachine = new AthenaQueryExecutorStateMachine(
      this,
      'AthenaQueryExecutorStateMachine',
      {
        athenaOutputBucket,
        executeAthenaQueryLambdaRoleArn,
        queryGenerateLambda,
        cachedQueryTable,
        federatedApi: props.federatedApi,
        queryParseRenderApi: props.queryParseRenderApi,
        dataProductApiBasePath: props.dataProductApi.basePath,
        governanceApi: props.governanceApi,
        counterTable,
        internalTokenKey,
        entityManagementTables,
        glueKmsKey,
        queryEventsStream,
        operationalMetricsConfig: props.operationalMetricsConfig, 
      },
    );

    this.api = new QueryApi(this, 'Api', {
      ...serviceConfig,
      federatedApi: props.federatedApi,
      athenaQueryExecutorStepFunction: athenaQueryExecutorStateMachine.stateMachine,
      dataProductApi: props.dataProductApi,
      athenaOutputBucket,
      queryGenerateLambda,
      queryHistoryTable,
      queryParseRenderApi: props.queryParseRenderApi,
      governanceApi: props.governanceApi,
      cachedQueryTable,
      savedPrivateQueryTable,
      savedPublicQueryTable,
      counterTable,
      internalTokenKey,
      entityManagementTables,
    });

    const { proxyDistributionDomain } = new AthenaProxyApiRoutes(this, 'AthenaProxy', {
      federatedApi: props.federatedApi,
      cognitoDomain,
      accessLogsBucket: props.accessLogsBucket,
    });
    this.proxyDistributionDomain = proxyDistributionDomain;
  }
}

export default QueryServiceStack;
