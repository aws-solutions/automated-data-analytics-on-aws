/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn, ArnComponents, ArnFormat, Stack } from 'aws-cdk-lib';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Database, IDatabase } from '@aws-cdk/aws-glue-alpha';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Function, IFunction } from 'aws-cdk-lib/aws-lambda';
import { IKey, Key } from 'aws-cdk-lib/aws-kms';
import { INotificationBus, NotificationBus } from '../../../api/components/notification/constructs/bus';
import { IRole, Role } from 'aws-cdk-lib/aws-iam';
import { IStateMachine, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { StaticInfrastructure } from '@ada/microservice-common';

export interface StaticInfrastructureReferencesProps {
  staticInfrastructure: StaticInfrastructure;
}

export interface GoogleCloudStorageConnectorRefs {
  readonly importDataStateMachine: IStateMachine;
}

export interface GoogleBigQueryConnectorRefs {
  readonly importDataStateMachine: IStateMachine;
}

export interface GoogleAnalyticsConnectorRefs {
  readonly importDataStateMachine: IStateMachine;
}

export interface StaticInfrastructureRefs {
  readonly counterTable: ITable;
  readonly notificationBus: INotificationBus;
  readonly glueDBArn: ArnComponents;
  readonly glueKmsKey: IKey;
  readonly glueDatabase: IDatabase;
  readonly scriptBucket: IBucket;
  readonly dataBucket: IBucket;
  readonly executeAthenaQueryLambdaRole: IRole;
  readonly crawlerStateMachine: IStateMachine;
  readonly executeGeneratedQueryStateMachine: IStateMachine;
  readonly getCrawledTableDetailsLambda: IFunction;
  readonly discoverTransformsLambda: IFunction;
  readonly prepareNextTransformLambda: IFunction;
  readonly prepareCtasQueryLambda: IFunction;
  readonly validateS3PathLambda: IFunction;
  readonly athenaUtilitiesLambdaName: string;
  readonly generatePIIQueryLambda: IFunction;
  readonly getPiiQueryResultLambda: IFunction;
  readonly prepareExternalImportLambda: IFunction;
  readonly startDataImportLambda: IFunction;
  readonly googleCloudStorageConnector: GoogleCloudStorageConnectorRefs;
  readonly googleBigQueryConnector: GoogleBigQueryConnectorRefs;
  readonly googleAnalyticsConnector: GoogleAnalyticsConnectorRefs;
  readonly glueSecurityConfigurationName: string;
}

/**
 * Construct to resolve references to static infrastructure as constructs for use in dynamic infrastructure.
 */
export default class StaticInfrastructureReferences extends Construct {
  public readonly staticInfrastructureReferences: StaticInfrastructureRefs;

  constructor(scope: Construct, id: string, { staticInfrastructure }: StaticInfrastructureReferencesProps) {
    super(scope, id);

    const counterTable = Table.fromTableName(this, 'CounterTable', staticInfrastructure.counterTableName);
    const bus = EventBus.fromEventBusName(this, 'EventBus', staticInfrastructure.eventBusName);
    const notificationBus = NotificationBus.fromEventBus(this, 'NotificationBus', bus);
    const glueDBArn = Arn.split(staticInfrastructure.glueDatabaseArn, ArnFormat.SLASH_RESOURCE_NAME);
    const glueDatabase = Database.fromDatabaseArn(this, 'GlueDatabase', staticInfrastructure.glueDatabaseArn);

    const scriptBucket = Bucket.fromBucketName(this, 'ScriptBucket', staticInfrastructure.scriptBucketName);
    const dataBucket = Bucket.fromBucketName(this, 'DataBucket', staticInfrastructure.dataBucketName);
    const glueKmsKey = Key.fromKeyArn(this, 'GlueKmsKey', staticInfrastructure.glueKmsKeyArn);

    const executeAthenaQueryLambdaRole = Role.fromRoleArn(
      this,
      'DynamicStackExecuteAthenaQueryLambdaRole',
      staticInfrastructure.executeAthenaQueryLambdaRoleArn,
    );

    const crawlerStateMachine = StateMachine.fromStateMachineArn(
      this,
      'GlueCrawlerStateMachineName',
      Arn.format(
        {
          resourceName: staticInfrastructure.glueCrawlerStateMachineName,
          resource: 'stateMachine',
          service: 'states',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
        },
        Stack.of(this),
      ),
    );
    const executeGeneratedQueryStateMachine = StateMachine.fromStateMachineArn(
      this,
      'ExecuteGovernedQueryStateMachine',
      staticInfrastructure.executeGeneratedQueryStateMachineArn,
    );

    const getCrawledTableDetailsLambda = Function.fromFunctionArn(
      this,
      'GetCrawledTableDetailsLambda',
      staticInfrastructure.lambdas.getCrawledTableDetailsArn,
    );

    const discoverTransformsLambda = Function.fromFunctionArn(
      this,
      'DiscoverTransformsLambda',
      staticInfrastructure.lambdas.discoverTransformsArn,
    );

    const prepareNextTransformLambda = Function.fromFunctionArn(
      this,
      'PrepareNextTransformLambda',
      staticInfrastructure.lambdas.prepareNextTransformArn,
    );

    const prepareExternalImportLambda = Function.fromFunctionArn(
      this,
      'PrepareExternalImportLambda',
      staticInfrastructure.lambdas.prepareExternalImportLambdaArn,
    );

    const prepareCtasQueryLambda = Function.fromFunctionArn(
      this,
      'PrepareCtasQueryLambda',
      staticInfrastructure.lambdas.prepareCtasQueryArn,
    );

    const validateS3PathLambda = Function.fromFunctionArn(
      this,
      'ValidateS3PathLambda',
      staticInfrastructure.lambdas.validateS3PathLambdaArn,
    );

    const startDataImportLambda = Function.fromFunctionArn(
      this,
      'StartDataImportLambda',
      staticInfrastructure.lambdas.startDataImportLambdaArn,
    );

    const googleStorageImportDataStateMachine = StateMachine.fromStateMachineArn(
      this,
      'GoogleStorageImportDataStateMachine',
      staticInfrastructure.googleCloudStorageConnector.importDataStateMachineArn,
    );

    const googleBigQueryImportDataStateMachine = StateMachine.fromStateMachineArn(
      this,
      'GoogleBigQueryImportDataStateMachine',
      staticInfrastructure.googleBigQueryConnector.importDataStateMachineArn,
    );

    const googleAnalyticsImportDataStateMachine = StateMachine.fromStateMachineArn(
      this,
      'GoogleAnalyticsImportDataStateMachine',
      staticInfrastructure.googleAnalyticsConnector.importDataStateMachineArn,
    );

    const athenaUtilitiesLambdaName = staticInfrastructure.lambdas.athenaUtilitiesLambdaName;

    const generatePIIQueryLambda = Function.fromFunctionArn(
      this,
      'GeneratePIIQueryLambda',
      staticInfrastructure.lambdas.generatePIIQueryLambdaArn,
    );

    const getPiiQueryResultLambda = Function.fromFunctionArn(
      this,
      'GetPiiQueryResultLambda',
      staticInfrastructure.lambdas.getPiiQueryResultLambdaArn,
    );

    this.staticInfrastructureReferences = {
      counterTable,
      notificationBus,
      glueDBArn,
      glueKmsKey,
      glueDatabase,
      scriptBucket,
      dataBucket,
      executeAthenaQueryLambdaRole,
      crawlerStateMachine,
      executeGeneratedQueryStateMachine,
      getCrawledTableDetailsLambda,
      discoverTransformsLambda,
      prepareNextTransformLambda,
      prepareCtasQueryLambda,
      validateS3PathLambda,
      startDataImportLambda,
      prepareExternalImportLambda,
      googleCloudStorageConnector: {
        importDataStateMachine: googleStorageImportDataStateMachine,
      },
      googleBigQueryConnector: {
        importDataStateMachine: googleBigQueryImportDataStateMachine,
      },
      googleAnalyticsConnector: {
        importDataStateMachine: googleAnalyticsImportDataStateMachine,
      },
      athenaUtilitiesLambdaName,
      generatePIIQueryLambda,
      getPiiQueryResultLambda,
      glueSecurityConfigurationName: staticInfrastructure.glueSecurityConfigurationName,
    };
  }
}
