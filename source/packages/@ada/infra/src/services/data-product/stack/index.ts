/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { ArnPrincipal, Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Microservice } from '@ada/microservice-common';
import { SchemaPreviewStack } from './schema-preview-stack';
import { StaticInfrastructureStack, StaticInfrastructureStackProps } from './static-infrastructure-stack';
import { getUniqueKmsKeyAlias } from '@ada/cdk-core';
import BuiltInTransformationStack from './built-in-transformation-statck';
import DataIngressGateway from '../core/network/transit-gateway';
import DataProductApi from '../api';
import DataProductApiStack from './api-stack';
import DataProductCreationStateMachine from '../components/creation-state-machine';
import serviceConfig from '../service-config';

export interface DataProductServiceStackProps extends Omit<StaticInfrastructureStackProps, 'glueKmsKey'> {}

/**
 * Data Product Service Stack
 */
export class DataProductServiceStack extends Microservice {
  readonly api: DataProductApi;

  readonly dataBuckets: Bucket[];

  readonly dataProductCreationStateMachine: DataProductCreationStateMachine;

  readonly dataProductTable: Table;
  readonly scriptTable: Table;
  readonly fileUploadBucket: Bucket;
  readonly domainTable: Table;

  readonly glueKmsKey: Key;

  // Data Ingress Gateway need to be exposed to Ada stack
  readonly dataIngressGateway: DataIngressGateway;

  constructor(scope: Construct, id: string, props: DataProductServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    this.glueKmsKey = new Key(this, 'GlueEncryptionKey', {
      alias: getUniqueKmsKeyAlias(this, 'glue-encryption'),
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // NOTE: can it be restricted further for glue? Likely not given policy limits and number of resources
    this.glueKmsKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey'],
        resources: ['*'],
        principals: [new ArnPrincipal(`arn:aws:iam::${this.account}:root`), new ServicePrincipal('glue.amazonaws.com')],
        conditions: {
          StringEquals: {
            'kms:CallerAccount': this.account,
          },
        },
      }),
    );

    // static resources
    const {
      dataProductCreationStateMachine,
      database,
      crawlerPollerStateMachine,
      executeGeneratedQueryStateMachine,
      dataBucket,
      glueSecurityConfigurationName,
      dataProductInfraLambdas,
      scriptBucket,
      staticInfraParameter,
      dataIngressVPC,
      dataIngressGateway,
    } = new StaticInfrastructureStack(this, 'StaticInfrastructure', {
      ...props,
      glueKmsKey: this.glueKmsKey,
    });
    this.dataProductCreationStateMachine = dataProductCreationStateMachine;
    this.dataIngressGateway = dataIngressGateway;

    new SchemaPreviewStack(this, 'SchemaPreview', {
      dataBucket,
      scriptBucket,
      dataIngressVPC,
      ...props,
    });

    this.scriptTable = new CountedTable(this, 'ScriptsTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'namespace',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'scriptId',
        type: AttributeType.STRING,
      },
      counterTable: props.counterTable,
    });

    this.fileUploadBucket = new Bucket(this, 'FileUploadBucket', {
      // We retain the file upload bucket and delete separately if we need to destroy all data too
      retain: true,
      // TODO: should this be custom KMS key? Likely need to ensure key permissions are granted
      // throughout the construction chain include to dynamic infra
      encryption: BucketEncryption.S3_MANAGED,
      cors: [
        {
          // TODO: restrict to have allowed origins strictly defined
          allowedOrigins: ['*'],
          allowedMethods: [HttpMethods.PUT, HttpMethods.POST],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'uploads-logs/',
      lifecycleRules: [
        {
          // delete objects after few days day
          enabled: true,
          abortIncompleteMultipartUploadAfter: Duration.days(2),
        },
      ],
    });

    this.domainTable = new CountedTable(this, 'DomainTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'domainId',
        type: AttributeType.STRING,
      },
      counterTable: props.counterTable,
    });

    this.dataProductTable = new CountedTable(this, 'DataProductTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'domainId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'dataProductId',
        type: AttributeType.STRING,
      },
      counterTable: props.counterTable,
    });

    [...dataProductCreationStateMachine.stepLambdas, dataProductInfraLambdas.startDataImportLambda].forEach(
      (lambda) => {
        this.dataProductTable.grantReadWriteData(lambda);
        lambda.addEnvironment('DATA_PRODUCT_TABLE_NAME', this.dataProductTable.tableName);
      },
    );

    // Prevent "Template may not exceed 1000000 bytes in size." by splitting api into separate stack
    const apiStack = new DataProductApiStack(this, 'ApiStack', {
      ...serviceConfig,
      dataProductTable: this.dataProductTable,
      domainTable: this.domainTable,
      fileUploadBucket: this.fileUploadBucket,
      scriptTable: this.scriptTable,
      federatedApi: props.federatedApi,
      executeAthenaQueryLambdaRoleArn: props.executeAthenaQueryLambdaRoleArn,
      dataProductCreationStateMachine,
      database,
      counterTable: props.counterTable,
      notificationBus: props.notificationBus,
      crawlerPollerStateMachine,
      executeGeneratedQueryStateMachine,
      dataBucket,
      governanceApi: props.governanceApi,
      ontologyApi: props.ontologyApi,
      internalTokenKey: props.internalTokenKey,
      entityManagementTables: props.entityManagementTables,
      glueKey: this.glueKmsKey,
      glueSecurityConfigurationName,
      dataProductInfraLambdas,
      athenaOutputBucket: props.athenaOutputBucket,
      scriptBucket,
      staticInfraParameter,
      accessLogsBucket: props.accessLogsBucket,
      operationalMetricsConfig: props.operationalMetricsConfig,
    });
    this.api = apiStack.api;
    this.dataBuckets = [dataBucket, this.fileUploadBucket];

    new BuiltInTransformationStack(this, 'BuiltInTransformationStack', {
      // decouple api stack from transform stack
      putScriptLambda: Function.fromFunctionArn(
        this,
        'IFunction-PutScript',
        this.api.functions.putScriptLambda.functionArn,
      ),
    });
  }
}

export default DataProductServiceStack;
