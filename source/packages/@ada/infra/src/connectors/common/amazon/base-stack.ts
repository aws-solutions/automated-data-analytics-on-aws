/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Choice,
  Condition,
  DefinitionBody,
  IStateMachine,
  IntegrationPattern,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import {
  DynamicInfraStackProps,
  DynamicInfrastructureStackBase,
} from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { DynamoAttributeValue, DynamoGetItem, StepFunctionsStartExecution } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { StaticInfra, s3PathJoin, toS3Path } from '@ada/infra-common/services';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { VError } from 'verror';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';
import Crawler from '@ada/dynamic-infra/constructs/glue/crawler';

export interface AmazonNativeConnectorSourceTaskProps extends DynamicInfraStackProps {
  importDataStateAccessor: (props: StaticInfra.Refs.IRecord) => IStateMachine;
  lastUpdatedDetailTableName: (props: StaticInfra.Refs.IRecord) => string | undefined;
  stateMachineInput: any;
  connectorId: string;
  connectorName: string;
  importStepName: string;
}

/**
 * Generic Base Amazon Native Connector Stack
 * This will provide the state machine to hande the data product lifecycle;
 * data import using the ecs cluster, storing last import data in a dynamodb table,
 * execute glue crawlers and tranforms on the imported data and handle success,
 * error and success no data to import (for subsequent on demand and schedule
 * import triggers) end states.
 */
export abstract class AmazonNativeConnectorSourceTask extends DynamicInfrastructureStackBase {
  constructor(scope: Construct, id: string, props: AmazonNativeConnectorSourceTaskProps) {
    super(scope, id, props);
  }

  protected getDefaultTransformRequired(): boolean {
    return false;
  }

  protected createDataSourceInfrastructureAndStateMachine({
    dataProduct,
    connectorId,
    importDataStateAccessor,
    lastUpdatedDetailTableName,
    stateMachineInput,
    importStepName,
  }: AmazonNativeConnectorSourceTaskProps): IStateMachine {
    const { dataBucket, glueDatabase, glueSecurityConfigurationName } = this.staticInfrastructureReferences;

    const tablePrefix = `${this.dataProductUniqueIdentifier}-aws-${connectorId}-`;

    const s3DestinationPath = s3PathJoin(this.dataBucketPath, `aws-${connectorId}-import`);

    const s3Target = {
      bucket: dataBucket.bucketName,
      key: s3DestinationPath,
    };

    const crawler = new Crawler(this, 'StartCrawler', {
      targetGlueDatabase: glueDatabase,
      targetDescription: { s3Target },
      tablePrefix: tablePrefix,
      glueSecurityConfigurationName,
      sourceAccessRole: this.role,
    });

    const prepareImportExternal = this.buildPrepareImportExternalStep(
      crawler,
      dataProduct,
      tablePrefix,
      toS3Path(s3Target),
    );

    const tableName = lastUpdatedDetailTableName(this.staticInfrastructureReferences);
    stateMachineInput.tableName = tableName;

    const getUpdatedInfo = new DynamoGetItem(this, 'GetNumLastUpdatedData', {
      key: {
        dataProductId: DynamoAttributeValue.fromString(stateMachineInput.dataProductId),
        domainId: DynamoAttributeValue.fromString(stateMachineInput.domainId),
      },
      table: Table.fromTableName(this, 'lastUpdatedDetailTableName', tableName!),
      resultPath: '$.taskresult',
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);

    const importData = new StepFunctionsStartExecution(this, importStepName, {
      stateMachine: importDataStateAccessor(this.staticInfrastructureReferences),
      input: TaskInput.fromObject({
        ...stateMachineInput,
        s3OutputPath: TaskInput.fromJsonPathAt('$.Payload.outputS3Path').value,
      }),
      integrationPattern: IntegrationPattern.RUN_JOB,
      resultPath: '$.ImportOutput',
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);

    const executeCrawler = this.buildExecuteCrawlerStep(crawler, '$.CrawlerOutput');

    // TaskInput.fromJsonPathAt('$.Payload.tablePrefix').value returns a token at the start of deployment which
    // gets resolved at execution time, we cannot use it as the id for lambda
    const getCrawledTableDetails = this.buildDiscoverCrawledTableStep(
      TaskInput.fromJsonPathAt('$.Payload.tablePrefix').value,
      'TableDetails',
      {
        ingestionTimestamp: TaskInput.fromJsonPathAt('$.Payload.ingestionTimestamp').value,
      },
    );

    const definition = prepareImportExternal.next(importData).next(
      new Choice(this, 'VerifyImportStatus')
        .when(
          Condition.not(Condition.stringEquals('$.ImportOutput.Output.status', 'SUCCEEDED')),
          new Pass(this, 'DeconstructErrorFromStateMachineExecution', {
            parameters: {
              ErrorDetails: TaskInput.fromObject({
                Error: TaskInput.fromJsonPathAt('$.ImportOutput.Output.error').value,
                // details.Cause contains a generic ECS task definition without much information
                Cause: TaskInput.fromJsonPathAt('$.ImportOutput.Output.details.Cause').value,
              }).value,
            },
          }).next(this.putErrorEventOnEventBridge),
        )
        .otherwise(
          getUpdatedInfo.next(
            new Choice(this, 'IsUpdateNeeded')
              .when(Condition.stringEquals('$.taskresult.Item.num_rows.S', '0'), this.putNoUpdateEventOnEventBridge)
              .otherwise(
                executeCrawler.next(
                  new Choice(this, 'VerifyCrawlerStepFunctionOutput')
                    .when(
                      Condition.stringEquals('$.CrawlerOutput.Output.Payload.status', 'FAILED'),
                      new Pass(this, 'DeconstructErrorFromCrawlerOutput', {
                        parameters: {
                          ErrorDetails: TaskInput.fromObject({
                            Error: TaskInput.fromJsonPathAt('$.CrawlerOutput.Output.Payload.error').value,
                          }).value,
                        },
                      }).next(this.putErrorEventOnEventBridge),
                    )
                    .otherwise(
                      getCrawledTableDetails.next(this.transformLoop.executeAllTransformsAndCompleteStateMachine()),
                    ),
                ),
              ),
          ),
        ),
    );

    return new StateMachine(this, 'StateMachine', {
      tracingEnabled: true,
      definitionBody: DefinitionBody.fromChainable(definition),
      role: this.role,
      logs: {
        destination: new LogGroup(this, 'StateMachineLogs', {
          logGroupName: getUniqueDataProductLogGroupName(
            this,
            'states',
            this.dataProductUniqueIdentifier,
            'StateMachineLogs',
          ),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }

  protected createAutomaticDataUpdateTriggerRule(props: AmazonNativeConnectorSourceTaskProps): Rule {
    throw new VError(
      { name: 'AutomaticTriggerNotSupportedError' },
      `Automatic trigger is not supported for a ${props.connectorName}, consider specifying a schedule at which to sync the data.`,
    );
  }
}
