/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from '../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { Database, JobBookmarksEncryptionMode, S3EncryptionMode, SecurityConfiguration } from '@aws-cdk/aws-glue-alpha';
import { ExtendedNestedStack, getUniqueName, globalHash } from '@ada/cdk-core';
import { Key } from 'aws-cdk-lib/aws-kms';
import { MicroserviceApi, MicroserviceProps, StaticInfrastructure } from '@ada/microservice-common';
import { Role } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import AthenaQueryExecutorStateMachine from '../../query/components/athena-query-executor-step-function';
import ContainerInfraStack from '../container/infra';
import CrawlerPollerStateMachine from '../components/crawler-poller-state-machine';
import DataProductCreationStateMachine from '../components/creation-state-machine';
import DataProductInfraLambdas from '../dynamic-infrastructure/lambdas';
import GoogleAnalyticsImportDataStateMachine from '../components/google-analytics-import-data-state-machine';
import GoogleBigQueryImportDataStateMachine from '../components/google-bigquery-import-data-state-machine';
import GoogleStorageImportDataStateMachine from '../components/google-storage-import-data-state-machine';
import Transforms from '../components/transforms';
import serviceConfig from '../service-config';

export interface StaticInfrastructureStackProps extends MicroserviceProps {
  glueKmsKey: Key;
  executeAthenaQueryLambdaRoleArn: string;
  governanceApi: MicroserviceApi;
  ontologyApi: MicroserviceApi;
  queryParseRenderApi: MicroserviceApi;
  cachedQueryTable: Table;
  athenaOutputBucket: Bucket;
  accessLogsBucket: Bucket;
}

/**
 * Nested stack for static infrastructure for data products
 */
export class StaticInfrastructureStack extends ExtendedNestedStack {
  public readonly glueKmsKey: Key;
  public readonly executeGeneratedQueryStateMachine: AthenaQueryExecutorStateMachine;
  public readonly crawlerPollerStateMachine: CrawlerPollerStateMachine;
  public readonly dataProductCreationStateMachine: DataProductCreationStateMachine;
  public readonly database: Database;
  public readonly dataBucket: Bucket;
  public readonly scriptBucket: Bucket;
  public readonly glueSecurityConfigurationName: string;
  public readonly googleStorageImportDataStateMachine: GoogleStorageImportDataStateMachine;
  public readonly googleBigQueryImportDataStateMachine: GoogleBigQueryImportDataStateMachine;
  public readonly googleAnalyticsImportDataStateMachine: GoogleBigQueryImportDataStateMachine;
  public readonly dataProductInfraLambdas: DataProductInfraLambdas;
  public readonly staticInfraParameter: StringParameter;

  constructor(scope: Construct, id: string, props: StaticInfrastructureStackProps) {
    super(scope, id, props);

    this.glueKmsKey = props.glueKmsKey;

    this.glueSecurityConfigurationName = getUniqueName(this, 'GlueSecurityConfig');

    new SecurityConfiguration(this, 'GlueSecurityConfiguration', {
      securityConfigurationName: this.glueSecurityConfigurationName,
      s3Encryption: {
        mode: S3EncryptionMode.S3_MANAGED,
      },
      jobBookmarksEncryption: {
        mode: JobBookmarksEncryptionMode.CLIENT_SIDE_KMS,
        kmsKey: this.glueKmsKey,
      },
    });
    this.database = new Database(this, 'DataProductDatabase', {
      databaseName: getUniqueName(this, 'data_product', { separator: '_' }),
    });
    this.dataBucket = new Bucket(this, 'DataBucket', {
      // We retain the data bucket and delete separately if we need to destroy all data too
      retain: true,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'data-logs/',
    });
    const executeAthenaQueryLambdaRole = Role.fromRoleArn(
      this,
      'DataProductExecuteAthenaQueryLambdaRole',
      props.executeAthenaQueryLambdaRoleArn,
    );

    this.dataBucket.grantRead(executeAthenaQueryLambdaRole);

    this.crawlerPollerStateMachine = new CrawlerPollerStateMachine(this, 'CrawlerPoller');
    this.dataProductCreationStateMachine = new DataProductCreationStateMachine(
      this,
      'DataProductCreationStateMachine',
      {
        notificationBus: props.notificationBus,
        glueCrawlerStateMachine: this.crawlerPollerStateMachine.stateMachine,
        federatedApi: props.federatedApi,
        counterTable: props.counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
      },
    );

    this.executeGeneratedQueryStateMachine = new AthenaQueryExecutorStateMachine(
      this,
      'ExecuteGovernedQueryStateMachine',
      {
        athenaOutputBucket: this.dataBucket,
        executeAthenaQueryLambdaRoleArn: props.executeAthenaQueryLambdaRoleArn,
        cachedQueryTable: props.cachedQueryTable,
        federatedApi: props.federatedApi,
        governanceApi: props.governanceApi,
        queryParseRenderApi: props.queryParseRenderApi,
        dataProductApiBasePath: `/${serviceConfig.serviceNamespace}`,
        counterTable: props.counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
        glueKmsKey: this.glueKmsKey,
      },
    );

    const containerStack = new ContainerInfraStack(this, 'ECSContainers', {
      dataBucket: this.dataBucket,
    });

    this.googleStorageImportDataStateMachine = new GoogleStorageImportDataStateMachine(
      this,
      'GCPImportDataStateMachine',
      {
        cluster: containerStack.googleStorageECSCluster.cluster,
        taskDefinition: containerStack.googleStorageECSCluster.taskDefinition,
        containerDefinition: containerStack.googleStorageECSCluster.containerDefinition,
        securityGroup: containerStack.ecsVpc.securityGroup,
        vpc: containerStack.ecsVpc.vpc,
      },
    );

    this.googleBigQueryImportDataStateMachine = new GoogleBigQueryImportDataStateMachine(
      this,
      'GCBigQueryImportDataStateMachine',
      {
        cluster: containerStack.googleBigQueryECSCluster.cluster,
        taskDefinition: containerStack.googleBigQueryECSCluster.taskDefinition,
        containerDefinition: containerStack.googleBigQueryECSCluster.containerDefinition,
        securityGroup: containerStack.ecsVpc.securityGroup,
        vpc: containerStack.ecsVpc.vpc,
      },
    );

    this.googleAnalyticsImportDataStateMachine = new GoogleAnalyticsImportDataStateMachine(
      this,
      'GAImportDataStateMachine',
      {
        cluster: containerStack.googleAnalyticsECSCluster.cluster,
        taskDefinition: containerStack.googleAnalyticsECSCluster.taskDefinition,
        containerDefinition: containerStack.googleAnalyticsECSCluster.containerDefinition,
        securityGroup: containerStack.ecsVpc.securityGroup,
        vpc: containerStack.ecsVpc.vpc,
      },
    );

    this.dataProductInfraLambdas = new DataProductInfraLambdas(this, 'DataProductInfraLambdas', {
      database: this.database,
      dataBucket: this.dataBucket,
      executeAthenaQueryLambdaRoleArn: props.executeAthenaQueryLambdaRoleArn,
      glueKmsKey: this.glueKmsKey,
      notificationBus: props.notificationBus,
      entityManagementTables: props.entityManagementTables,
    });

    this.scriptBucket = new Bucket(this, 'ScriptsBucket', {
      retain: true,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'scripts-logs/',
    });
    new Transforms(this, 'Transforms', { scriptBucket: this.scriptBucket });

    const staticInfra: StaticInfrastructure = {
      globalHash: globalHash(this),
      counterTableName: props.counterTable.tableName,
      glueKmsKeyArn: this.glueKmsKey.keyArn,
      glueSecurityConfigurationName: this.glueSecurityConfigurationName,
      glueDatabaseArn: this.database.databaseArn,
      eventBusName: props.notificationBus.eventBus.eventBusName,
      glueCrawlerStateMachineName: this.crawlerPollerStateMachine.stateMachine.stateMachineName,
      executeGeneratedQueryStateMachineArn: this.executeGeneratedQueryStateMachine.stateMachine.stateMachineArn,
      scriptBucketName: this.scriptBucket.bucketName,
      dataBucketName: this.dataBucket.bucketName,
      lambdas: this.dataProductInfraLambdas.lambdas,
      executeAthenaQueryLambdaRoleArn: props.executeAthenaQueryLambdaRoleArn,
      googleCloudStorageConnector: {
        importDataStateMachineArn: this.googleStorageImportDataStateMachine.stateMachine.stateMachineArn,
      },
      googleBigQueryConnector: {
        importDataStateMachineArn: this.googleBigQueryImportDataStateMachine.stateMachine.stateMachineArn,
      },
      googleAnalyticsConnector: {
        importDataStateMachineArn: this.googleAnalyticsImportDataStateMachine.stateMachine.stateMachineArn,
      },
    };

    // Move static infra configuration to parameter to avoid exceeding 4KB max environment size
    this.staticInfraParameter = new StringParameter(this, 'StaticInfraConfig', {
      stringValue: JSON.stringify(staticInfra),
    });

    this.dataProductCreationStateMachine.stepLambdas.forEach((lambda) => {
      lambda.addEnvironment(
        'DATA_PRODUCT_STATIC_INFRASTRUCTURE_PARAMETER_NAME',
        this.staticInfraParameter.parameterName,
      );
      this.staticInfraParameter.grantRead(lambda);
    });
  }
}

export default StaticInfrastructureStack;
