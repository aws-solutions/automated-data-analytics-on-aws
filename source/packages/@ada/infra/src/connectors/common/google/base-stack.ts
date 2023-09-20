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
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { StaticInfra, s3PathJoin, toS3Path } from '@ada/infra-common/services';
import { StepFunctionsStartExecution } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { VError } from 'verror';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';
import Crawler from '@ada/dynamic-infra/constructs/glue/crawler';

export interface GoogleConnectorSourceTaskProps extends DynamicInfraStackProps {
  importDataStateAccessor: (props: StaticInfra.Refs.IRecord) => IStateMachine;
  stateMachineInput: any;
  connectorId: string;
  connectorName: string;
  importStepName: string;
}

/**
 * Stack for a data product that uses a base generic Google Connector
 */
export abstract class GoogleConnectorSourceTask extends DynamicInfrastructureStackBase {
  constructor(scope: Construct, id: string, props: GoogleConnectorSourceTaskProps) {
    super(scope, id, props);
  }

  protected getDefaultTransformRequired(): boolean {
    return false;
  }

  protected createDataSourceInfrastructureAndStateMachine({
    dataProduct,
    connectorId,
    importDataStateAccessor,
    stateMachineInput,
    importStepName,
  }: GoogleConnectorSourceTaskProps): IStateMachine {
    const { dataBucket, glueDatabase, glueSecurityConfigurationName } = this.staticInfrastructureReferences;

    const tablePrefix = `${this.dataProductUniqueIdentifier}-gcp-${connectorId}-`;

    const s3DestinationPath = s3PathJoin(this.dataBucketPath, `gcp-${connectorId}-import`);

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
              .otherwise(getCrawledTableDetails.next(this.transformLoop.executeAllTransformsAndCompleteStateMachine())),
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

  protected createAutomaticDataUpdateTriggerRule(props: GoogleConnectorSourceTaskProps): Rule {
    throw new VError(
      { name: 'AutomaticTriggerNotSupportedError' },
      `Automatic trigger is not supported for a ${props.connectorName}, consider specifying a schedule at which to sync the data.`,
    );
  }
}
