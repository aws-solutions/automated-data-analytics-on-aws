/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AthenaQueryExecutionState, CallingUser, DataSetIds } from '@ada/common';
import {
  Choice,
  Condition,
  IChainable,
  IStateMachine,
  IntegrationPattern,
  LogLevel,
  Map,
  Pass,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { DataProduct } from '@ada/api';
import { DataProductEventDetailTypes, EventSource, s3PathJoin, toS3Path } from '@ada/microservice-common';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { JSON_PATH_AT } from '../types';
import { LambdaInvoke, StepFunctionsStartExecution } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Rule } from 'aws-cdk-lib/aws-events';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';
import Crawler from '../constructs/glue/crawler';
import DynamicInfrastructureStackBase, {
  DynamicInfrastructureStackBaseProps,
} from './dynamic-infrastructure-stack-base';

export interface QuerySourceStackProps extends DynamicInfrastructureStackBaseProps {
  readonly generatedQuery: string;
  readonly parentDataProducts: DataProduct[];
}

/**
 * Stack for a data product from a query
 */
export class QuerySourceStack extends DynamicInfrastructureStackBase<QuerySourceStackProps> {
  constructor(scope: Construct, id: string, props: QuerySourceStackProps) {
    super(scope, id, {
      ...props,
      // Send the parent data product identifiers as part of the success/error events for this data product
      additionalNotificationPayload: {
        parentDataProducts: props.parentDataProducts.map(({ domainId, dataProductId }) => ({
          domainId,
          dataProductId,
        })),
      },
    });
  }

  /**
   * Execute an athena query via step functions
   * @param id unique id for cdk constructs
   * @param query the sql query to run, can be a task input reference
   * @param dataProduct the data product
   * @param callingUser the user creating the data product
   * @param onSuccess step function steps to execute when the query succeeds.
   * @param onError step function steps to execute when an error occurs
   */
  private executeQuery(
    id: string,
    query: string,
    dataProduct: DataProduct,
    callingUser: CallingUser,
    onSuccess: IChainable,
    onError: IChainable = this.putErrorEventOnEventBridge,
  ) {
    const runQuery = new StepFunctionsStartExecution(this, `ExecuteQuery${id}`, {
      stateMachine: this.staticInfrastructureReferences.executeGeneratedQueryStateMachine,
      input: TaskInput.fromObject({
        query,
        callingUser,
        outputS3Path: toS3Path({
          bucket: this.staticInfrastructureReferences.dataBucket.bucketName,
          // Write query output to a different location to ensure it does not interfere with the data
          key: s3PathJoin(dataProduct.domainId, dataProduct.dataProductId, this.stackIdentifier, 'temp'),
        }),
      }),
      integrationPattern: IntegrationPattern.RUN_JOB,
      resultPath: JSON_PATH_AT.QUERY_OUTPUT,
    }).addCatch(onError, this.catchProps);

    return runQuery.next(
      new Choice(this, `VerifyQuery${id}Status`)
        .when(
          Condition.not(
            Condition.stringEquals(
              JSON_PATH_AT.QUERY_OUTPUT__OUTPUT__ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE,
              AthenaQueryExecutionState.SUCCEEDED,
            ),
          ),
          new Pass(this, `Query${id}Failed`, {
            parameters: {
              ErrorDetails: {
                Error: TaskInput.fromJsonPathAt(
                  JSON_PATH_AT.QUERY_OUTPUT__OUTPUT__ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE_CHANGE_REASON,
                ).value,
              },
            },
          }).next(onError),
        )
        .otherwise(onSuccess),
    );
  }

  protected createDataSourceInfrastructureAndStateMachine({
    dataProduct,
    generatedQuery,
    callingUser,
  }: QuerySourceStackProps): IStateMachine {
    const { dataBucket, glueDatabase, glueDBArn, prepareCtasQueryLambda, glueSecurityConfigurationName } =
      this.staticInfrastructureReferences;

    const tablePrefix = `${this.dataProductUniqueIdentifier}-query-`;
    const queryOutputS3Target = {
      bucket: dataBucket.bucketName,
      key: s3PathJoin(dataProduct.domainId, dataProduct.dataProductId, 'query-output', DataSetIds.DEFAULT),
    };
    const outputS3Path = toS3Path(queryOutputS3Target);

    const crawler = new Crawler(this, 'Crawler', {
      s3Target: queryOutputS3Target,
      tablePrefix,
      targetGlueDatabase: glueDatabase,
      glueSecurityConfigurationName,
      sourceAccessRole: this.role,
    });

    const prepareCtasQuery = new LambdaInvoke(this, 'PrepareCTASQuery', {
      lambdaFunction: prepareCtasQueryLambda,
      payload: TaskInput.fromObject({
        Payload: {
          crawlerName: crawler.crawler.name!,
          dataProduct,
          tablePrefix,
          selectQuery: generatedQuery,
          outputS3Path,
          database: glueDBArn.resourceName,
        },
      }),
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);

    // Step to discover the table we created through the CTAS query
    const executeCrawler = this.buildExecuteCrawlerStep(crawler, JSON_PATH_AT.CRAWL_OUTPUT);
    const getCrawledTableDetails = this.buildDiscoverCrawledTableStep(
      TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_PREFIX).value,
      'TableDetails',
      {
        dropTableQueries: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__DROP_TABLE_QUERIES).value,
      },
    );

    // Clean up any ephemeral/old tables. This is done after the final notification of success, so does not affect the
    // success/failure outcome of the data update, and tables to drop will no longer be referenced by the data product.
    const onSuccess = this.putSuccessEventOnEventBridge
      .next(new Wait(this, 'Wait30Seconds', { time: WaitTime.duration(Duration.seconds(30)) }))
      .next(
        new Map(this, 'CleanUpTables', {
          itemsPath: JSON_PATH_AT.PAYLOAD__DROP_TABLE_QUERIES,
          resultPath: JSON_PATH_AT.CLEAN_TABLES_OUTPUT,
        }).iterator(
          this.executeQuery(
            'CleanTables',
            TaskInput.fromJsonPathAt(JSON_PATH_AT.QUERY).value,
            dataProduct,
            callingUser,
            new Pass(this, 'Cleaned'),
            new Pass(this, 'FailedToClean'),
          ),
        ),
      );

    const definition = prepareCtasQuery.next(
      this.executeQuery(
        'CTAS',
        TaskInput.fromJsonPathAt(JSON_PATH_AT.CTAS_QUERY).value,
        dataProduct,
        callingUser,
        executeCrawler.next(
          new Choice(this, 'VerifyCrawlerStepFunctionOutput')
            // Look at the "status" field
            .when(
              Condition.stringEquals(JSON_PATH_AT.CRAWL_OUTPUT__OUTPUT__PAYLOAD__STATUS, 'FAILED'),
              this.putErrorEventOnEventBridge,
            )
            .otherwise(
              getCrawledTableDetails.next(
                this.transformLoop.executeAllTransformsAndCompleteStateMachine(onSuccess, {
                  dropTableQueries: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__DROP_TABLE_QUERIES).value,
                }),
              ),
            ),
        ),
      ),
    );

    return new StateMachine(this, 'StateMachine', {
      tracingEnabled: true,
      definition,
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

  protected createAutomaticDataUpdateTriggerRule({ parentDataProducts }: QuerySourceStackProps): Rule {
    // Trigger an update from the "success" event from any of the parent data products
    return this.staticInfrastructureReferences.notificationBus.addRule('ParentDataProductUpdateSuccess', {
      // ruleName: `${this.dataProductUniqueIdentifier}-auto-update-trigger`,
      description: 'Triggered when parent data products are successfully updated',
      notificationPattern: {
        source: [EventSource.DATA_PRODUCTS],
        type: [DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS],
        payload: {
          dataProductCompositeIdentifier: parentDataProducts.map(
            ({ domainId, dataProductId }) => `${domainId}.${dataProductId}`,
          ),
        },
      },
    });
  }
}
