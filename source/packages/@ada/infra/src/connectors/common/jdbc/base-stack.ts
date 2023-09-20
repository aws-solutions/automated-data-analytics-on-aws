/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Aws, RemovalPolicy } from 'aws-cdk-lib';
import { CfnConnection } from 'aws-cdk-lib/aws-glue';
import {
  Choice,
  Condition,
  DefinitionBody,
  IStateMachine,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Crawler } from '@ada/dynamic-infra/constructs/glue/crawler';
import {
  DynamicInfraStackProps,
  DynamicInfrastructureStackBase,
} from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';

import { ISourceDetails__JDBC } from './types';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Rule } from 'aws-cdk-lib/aws-events';
import { VError } from 'verror';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';

/**
 * Stack for dynamic infrastructure for an s3 source'd data product
 */
export abstract class JDBCSourceStackBase extends DynamicInfrastructureStackBase {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    super(scope, id, {
      ...props,
    });
  }

  // Define Connection Name so that the first transform in Glue Job will read from the database
  // If not using connection in glue, remove this override function
  protected getConnectionName(): string {
    return `${this.dataProductUniqueIdentifier}-connection`;
  }

  protected getDefaultTransformRequired(): boolean {
    return true;
  }

  protected abstract getConnectionString(sourceDetails: ISourceDetails__JDBC): string;

  protected createDataSourceInfrastructureAndStateMachine(props: DynamicInfraStackProps): IStateMachine {
    const { dataProduct } = props;
    const { sourceDetails } = dataProduct;

    const { glueDatabase, glueSecurityConfigurationName, dataIngressVPC } = this.staticInfrastructureReferences;

    const { databaseName, databaseSchema, databaseTable, dbCredentialSecretName } =
      sourceDetails as ISourceDetails__JDBC;
    const jdbcConnectionString = this.getConnectionString(sourceDetails as ISourceDetails__JDBC);
    const userName = (sourceDetails as ISourceDetails__JDBC).username;

    // pick the first private with egress subnet as glue subnet and the first availabile zone
    const glueSubnetId = dataIngressVPC.subnetIds[0];
    const glueAvailabilityZone = dataIngressVPC.availabilityZones[0];

    // Create a glue connection for the database
    new CfnConnection(this, 'glueConnection', {
      catalogId: Aws.ACCOUNT_ID,
      connectionInput: {
        name: this.glueConnectionName,
        description: 'Connect to database',
        connectionType: 'JDBC',
        connectionProperties: {
          JDBC_CONNECTION_URL: jdbcConnectionString,
          USERNAME: userName,
          PASSWORD: `{{resolve:secretsmanager:${dbCredentialSecretName}}}`,
          JDBC_ENFORCE_SSL: 'false',
          KAFKA_SSL_ENABLED: 'false',
        },
        physicalConnectionRequirements: {
          securityGroupIdList: dataIngressVPC.securityGroupIds,
          subnetId: glueSubnetId,
          availabilityZone: glueAvailabilityZone,
        },
      },
    });

    // Create a crawler which will read the source data from a jdbc data source and populate one or more tables
    const startTablePrefix = `${this.dataProductUniqueIdentifier}-start`;
    const jdbcPath = databaseName + '/' + (databaseSchema ? `${databaseSchema}/` : '') + databaseTable;
    const crawler = new Crawler(this, 'StartCrawler', {
      targetGlueDatabase: glueDatabase,
      targetDescription: {
        jdbcTarget: {
          connectionName: this.glueConnectionName,
          path: jdbcPath,
          exclusions: [],
        },
      },
      tablePrefix: startTablePrefix,
      glueSecurityConfigurationName,
      sourceAccessRole: this.role,
    });

    const { executeCrawler, getCrawledTableDetails } = this.buildExecuteCrawlerAndDiscoverCrawledTableSteps(crawler);

    // Execute the crawler on the source data, and retrieve the crawled table details and apply transforms
    // on all discovered tables
    const definition = executeCrawler.next(
      new Choice(this, 'VerifyCrawlerStepFunctionOutput')
        // Look at the "status" field
        .when(
          Condition.stringEquals('$.Output.Payload.status', 'FAILED'),
          new Pass(this, 'DeconstructErrorFromStateMachineExecution', {
            parameters: {
              ErrorDetails: TaskInput.fromObject({
                Error: TaskInput.fromJsonPathAt('$.Output.Payload.error').value,
              }).value,
            },
          }).next(this.putErrorEventOnEventBridge),
        )
        .otherwise(getCrawledTableDetails.next(this.transformLoop.executeAllTransformsAndCompleteStateMachine())),
    );

    // State machiine to orchestrating data product importing
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

  protected createAutomaticDataUpdateTriggerRule(props: DynamicInfraStackProps): Rule {
    throw new VError(
      { name: 'AutomaticTriggerNotSupportedError' },
      `Automatic trigger is not supported for a ${props.dataProduct.name}, consider specifying a schedule at which to sync the data.`,
    );
  }
}

export default JDBCSourceStackBase;
