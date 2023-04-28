/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn, ArnFormat, Stack } from 'aws-cdk-lib';
import { Bucket } from '../../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { Database } from '@aws-cdk/aws-glue-alpha';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../../api/components/entity/constructs/entity-management-tables';
import { JavaFunction, TypescriptFunction } from '@ada/infra-common';
import { Key } from 'aws-cdk-lib/aws-kms';
import { NotificationBus } from '../../../api/components/notification/constructs/bus';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';
import type { StaticInfra } from '@ada/infra-common/services';

export interface DataProductInfraLambdasProps {
  executeAthenaQueryLambdaRoleArn: string;
  database: Database;
  dataBucket: Bucket;
  glueKmsKey: Key;
  entityManagementTables: EntityManagementTables;
  notificationBus: NotificationBus;
}

/**
 * Defines the lambdas that may be referenced by data product dynamic infra
 */
export class DataProductInfraLambdas extends Construct {
  public readonly lambdas: StaticInfra.Lambdas;
  public readonly startDataImportLambda: TypescriptFunction;

  constructor(scope: Construct, id: string, props: DataProductInfraLambdasProps) {
    super(scope, id);

    const buildLambda = (handlerFile: string, additionalPolices?: PolicyStatement[]) => {
      const lambda = new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'data-product-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        notificationBus: props.notificationBus,
        entityManagementTables: props.entityManagementTables,
      });

      lambda.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['glue:GetTables', 'glue:UpdateTable', 'glue:DeletePartitionIndex'],
          resources: [
            Arn.format(
              {
                resource: `table/${props.database.databaseName}/*`,
                service: 'glue',
              },
              Stack.of(this),
            ),
            Arn.format(
              {
                resource: `database/${props.database.databaseName}`,
                service: 'glue',
              },
              Stack.of(this),
            ),
            Arn.format(
              {
                resource: 'catalog',
                service: 'glue',
              },
              Stack.of(this),
            ),
          ],
        }),
      );

      lambda.addToRolePolicy(
        new PolicyStatement({
          actions: ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:Encrypt'],
          effect: Effect.ALLOW,
          resources: [props.glueKmsKey.keyArn],
        }),
      );

      // add additional policies
      if (additionalPolices && additionalPolices.length > 0) {
        for (const policy of additionalPolices) lambda.addToRolePolicy(policy);
      }

      return lambda;
    };

    const athenaUtilitiesLambda = new JavaFunction(this, 'GovernanceAthenaUtilsLambda', {
      package: 'athena-utilities',
      handler: 'com.ada.pii.detection.TextAnalyticsUDFHandler',
      alias: 'prod',
    }).alias;

    athenaUtilitiesLambda.grantInvoke(
      Role.fromRoleArn(this, 'QueryExecuteAthenaUtilsRole', props.executeAthenaQueryLambdaRoleArn),
    );

    athenaUtilitiesLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['comprehend:DetectPiiEntities'],
        resources: ['*'],
      }),
    );

    const prepareExternalImport = buildLambda('external-import/prepare-external-import');
    prepareExternalImport.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['glue:UpdateCrawler'],
        resources: [
          Stack.of(this).formatArn({
            service: 'glue',
            resource: 'crawler',
            resourceName: '*',
          }),
        ],
      }),
    );

    const s3accessToDataBucketPolicy = new PolicyStatement({
      actions: ['s3:List*', 's3:Get*'],
      resources: [
        Stack.of(this).formatArn({
          region: '',
          account: '',
          service: 's3',
          resource: props.dataBucket.bucketName,
        }),
        Stack.of(this).formatArn({
          region: '',
          account: '',
          service: 's3',
          resource: props.dataBucket.bucketName,
          resourceName: '*',
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
        }),
      ],
      effect: Effect.ALLOW,
    });
    const validateS3PathLambda = buildLambda('validate-s3-path-lambda');
    validateS3PathLambda.addToRolePolicy(s3accessToDataBucketPolicy);

    const getPiiQueryResultLambda = buildLambda('get-pii-query-result');
    getPiiQueryResultLambda.addToRolePolicy(s3accessToDataBucketPolicy);
    getPiiQueryResultLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['athena:GetQueryResults'],
        resources: [
          Stack.of(this).formatArn({
            service: 'athena',
            resource: `workgroup/*`,
          }),
        ],
        effect: Effect.ALLOW,
      }),
    );

    if (props.dataBucket.encryptionKey) {
      getPiiQueryResultLambda.addToRolePolicy(
        new PolicyStatement({
          actions: ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:Encrypt'],
          effect: Effect.ALLOW,
          resources: [props.dataBucket.encryptionKey.keyArn],
        }),
      );
    }

    this.startDataImportLambda = buildLambda('start-data-import');
    this.startDataImportLambda.addPermission('EventBridgeTrigger', {
      principal: new ServicePrincipal('events.amazonaws.com'),
    });
    this.startDataImportLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['states:ListExecutions', 'states:StartExecution'],
        // Grant access to list/start all state machines since state machines are created in dynamic infrastructure
        resources: ['*'],
      }),
    );
    addCfnNagSuppressionsToRolePolicy(this.startDataImportLambda.role!, [
      {
        id: 'W12',
        reason:
          'Start data import api is allowed to read status of/start all data product state machines, and arns are not known until runtime',
      },
    ]);

    // additional policy for prepare-transform-chain
    const policyUpdateCrawler = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['glue:UpdateCrawler'],
      resources: [
        Stack.of(this).formatArn({
          service: 'glue',
          resource: 'crawler',
          resourceName: '*',
        }),
      ],
    });

    this.lambdas = {
      getCrawledTableDetailsArn: buildLambda('get-crawled-table-details').functionArn,
      prepareTransformChainArn: buildLambda('prepare-transform-chain', [policyUpdateCrawler]).functionArn,
      prepareNextTransformArn: buildLambda('prepare-next-transform').functionArn,
      validateS3PathLambdaArn: validateS3PathLambda.functionArn,
      athenaUtilitiesLambdaName: athenaUtilitiesLambda.functionName,
      generatePIIQueryLambdaArn: buildLambda('generate-pii-query').functionArn,
      getPiiQueryResultLambdaArn: getPiiQueryResultLambda.functionArn,
      prepareExternalImportLambdaArn: prepareExternalImport.functionArn,
      startDataImportLambdaArn: this.startDataImportLambda.functionArn,
    };
  }
}

export default DataProductInfraLambdas;
