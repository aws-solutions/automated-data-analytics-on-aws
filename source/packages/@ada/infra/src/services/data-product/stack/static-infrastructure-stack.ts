/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { CfnResource, Lazy, RemovalPolicy } from 'aws-cdk-lib';
import { Connectors } from '@ada/connectors';
import { Construct } from 'constructs';
import { Database, JobBookmarksEncryptionMode, S3EncryptionMode, SecurityConfiguration } from '@aws-cdk/aws-glue-alpha';
import { ExtendedNestedStack, addCfnNagSuppressions, getUniqueName, globalHash } from '@ada/cdk-core';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ParameterTier, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Role } from 'aws-cdk-lib/aws-iam';
import { StaticInfra } from '@ada/microservice-common';
import AthenaQueryExecutorStateMachine from '../../query/components/athena-query-executor-step-function';
import CrawlerPollerStateMachine from '../components/crawler-poller-state-machine';
import DataIngressGateway from '../core/network/transit-gateway';
import DataIngressVPC from '../core/network/vpc';
import DataProductCreationStateMachine from '../components/creation-state-machine';
import DataProductInfraLambdas from '../dynamic-infrastructure/lambdas';
import IngressContainerInfra from '../container/infra';
import Transforms from '../components/transforms';
import serviceConfig from '../service-config';

export type StaticInfrastructureStackProps = StaticInfra.Stack.IConstructProps;

/**
 * Nested stack for static infrastructure for data products
 */
class BaseStaticInfrastructureStack extends ExtendedNestedStack implements StaticInfra.Stack.IBaseConstruct {
  public readonly glueKmsKey: Key;
  public readonly executeGeneratedQueryStateMachine: AthenaQueryExecutorStateMachine;
  public readonly crawlerPollerStateMachine: CrawlerPollerStateMachine;
  public readonly dataProductCreationStateMachine: DataProductCreationStateMachine;
  public readonly database: Database;
  public readonly dataBucket: Bucket;
  public readonly scriptBucket: Bucket;
  public readonly glueSecurityConfigurationName: string;
  public readonly dataProductInfraLambdas: DataProductInfraLambdas;
  public readonly lastUpdatedDetailTable: Table;

  public readonly staticInfraParameter: StringParameter;
  public readonly dataIngressVPC: DataIngressVPC;
  public readonly ingressContainerInfra: IngressContainerInfra;
  public readonly dataIngressGateway: DataIngressGateway;

  public readonly staticInfraParameterValue: StaticInfra.IStaticParamsBase;

  constructor(scope: Construct, id: string, props: StaticInfra.Stack.IConstructProps) {
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
        operationalMetricsConfig: props.operationalMetricsConfig,
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
        operationalMetricsConfig: props.operationalMetricsConfig,
      },
    );

    this.dataIngressVPC = new DataIngressVPC(this, 'DataIngressVpc');

    this.dataIngressGateway = new DataIngressGateway(this, 'DataIngressGateway', {
      dataIngressVPC: this.dataIngressVPC,
    });

    this.ingressContainerInfra = new IngressContainerInfra(this, 'ECSContainers', {
      dataBucket: this.dataBucket,
      dataIngressVpc: this.dataIngressVPC,
    });

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

    this.lastUpdatedDetailTable = new Table(this, 'LastUpdatedDetail', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: { name: 'dataProductId', type: AttributeType.STRING },
      sortKey: { name: 'domainId', type: AttributeType.STRING },
      pointInTimeRecovery: true,
    });

    addCfnNagSuppressions(this.lastUpdatedDetailTable.node.defaultChild as CfnResource, [
      {
        id: 'W74',
        reason: 'Table with no sensitive data and using AWS_MANAGED encryption',
      },
    ]);

    // collect subnet info from DataIngressVPC
    const subnetIds: string[] = [];
    const availabilityZones: string[] = [];
    for (const subnet of this.dataIngressVPC.vpc.privateSubnets) {
      subnetIds.push(subnet.subnetId);
      availabilityZones.push(subnet.availabilityZone);
    }
    // collect security groups info from DataIngressVPC
    const securityGroupIds = [
      this.dataIngressVPC.glueConnectionSecurityGroup,
      this.dataIngressVPC.glueJDBCTargetSecurityGroup,
    ].map((securityGroup) => securityGroup.securityGroupId);

    // NB: Parameter value here is "base" value, connectors will apply missing props
    this.staticInfraParameterValue = {
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
      dataIngressVPC: {
        subnetIds,
        availabilityZones,
        securityGroupIds,
      },
    };

    // Move static infra configuration to parameter to avoid exceeding 4KB max environment size
    this.staticInfraParameter = new StringParameter(this, 'StaticInfraConfig', {
      // Resolve the `staticInfraParams` value after connectors have been applied.
      // This will be modified to become `StaticInfra.IStaticParams` which includes all
      // connector parameters rather than `StaticInfra.IStaticParamsBase` in this construct.
      stringValue: Lazy.string({
        produce: () => {
          return JSON.stringify(this.staticInfraParameterValue);
        },
      }),
      tier: ParameterTier.ADVANCED
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

export const StaticInfrastructureStack = function StaticInfrastructureStack(
  ...args: StaticInfra.Stack.IConstructParameters
): StaticInfra.Stack.IConstruct {
  require('@ada/connectors/register-infra');

  const DecoratedClass = Connectors.Infra.Static.withStaticInfra(BaseStaticInfrastructureStack);

  return new DecoratedClass(...args);
} as unknown as StaticInfra.Stack.IConstructClass;

export default StaticInfrastructureStack;