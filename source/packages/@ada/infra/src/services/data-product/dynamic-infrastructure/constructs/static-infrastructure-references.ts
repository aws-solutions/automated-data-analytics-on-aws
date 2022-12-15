/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn, ArnFormat, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Connectors } from '@ada/connectors';
import { Construct } from 'constructs';
import { Database } from '@aws-cdk/aws-glue-alpha';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Key } from 'aws-cdk-lib/aws-kms';
import { NotificationBus } from '../../../api/components/notification/constructs/bus';
import { Role } from 'aws-cdk-lib/aws-iam';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { StaticInfra } from '@ada/microservice-common';

/**
 * Construct to resolve references to static infrastructure as constructs for use in dynamic infrastructure.
 */
class BaseStaticInfrastructureReferences extends Construct implements StaticInfra.Refs.IBaseConstruct {
  public readonly staticInfrastructureReferences: StaticInfra.Refs.IBaseRecord;

  constructor(scope: Construct, id: string, { staticInfrastructure }: StaticInfra.Refs.IConstructProps) {
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

    const prepareTransformChainLambda = Function.fromFunctionArn(
      this,
      'PrepareTransformChainLambda',
      staticInfrastructure.lambdas.prepareTransformChainArn,
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

    // NB: Connectors.Infra.Static.withStaticInfraRefs will apply additional refs
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
      prepareTransformChainLambda,
      prepareNextTransformLambda,
      validateS3PathLambda,
      startDataImportLambda,
      prepareExternalImportLambda,
      athenaUtilitiesLambdaName,
      generatePIIQueryLambda,
      getPiiQueryResultLambda,
      glueSecurityConfigurationName: staticInfrastructure.glueSecurityConfigurationName,
      dataIngressVPC: staticInfrastructure.dataIngressVPC,
    };
  }
}

export const StaticInfrastructureReferences = function StaticInfrastructureReferences(
  ...args: StaticInfra.Refs.IConstructParameters
): StaticInfra.Refs.IConstruct {
  require('@ada/connectors/register-infra');

  const DecoratedClass = Connectors.Infra.Static.withStaticInfraRefs(BaseStaticInfrastructureReferences);

  return new DecoratedClass(...args);
} as unknown as StaticInfra.Refs.IConstructClass;

export default StaticInfrastructureReferences;
