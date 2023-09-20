/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import {
  CatchProps,
  Choice,
  Condition,
  IChainable,
  IntegrationPattern,
  Map,
  Pass,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { DataProduct } from '@ada/api';
import {
  EventBridgePutEvents,
  GlueStartJobRun,
  LambdaInvoke,
  StepFunctionsStartExecution,
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { ExternalFacingRole } from '@ada/infra-common/constructs/iam/external-facing-role';
import { JSON_PATH_AT } from '../../types';
import { StaticInfra, s3PathJoin, toS3Path } from '@ada/microservice-common';
import TransformJobsAndCrawlers from '../glue/transform-jobs-and-crawlers';

export interface ArbitraryTransformLoopProps {
  readonly dataProductUniqueIdentifier: string;
  readonly dataBucketPath: string;
  readonly dataProduct: DataProduct;
  readonly callingUser: CallingUser;
  readonly staticInfrastructureReferences: StaticInfra.Refs.IRecord;
  readonly putSuccessEventOnEventBridge: EventBridgePutEvents;
  readonly putErrorEventOnEventBridge: EventBridgePutEvents;
  readonly sourceAccessRole: ExternalFacingRole;
  readonly glueConnectionNames?: string[];
  readonly defaultTransformRequired: boolean;
  readonly extraJobArgs?: { [key: string]: string };
}

/**
 * Defines a section of step function state machine which will execute all required transforms for a data product.
 * It expects a previous step in the state machine to populate the "tablePrefix" and "tableDetails" array for the
 * tables used as the initial input to the transform loop.
 *
 * This should be used as the last step of the data product import workflow since it notifies of completion.
 */
export default class ArbitraryTransformLoop extends Construct {
  public readonly transformJobsAndCrawlers: TransformJobsAndCrawlers;

  private readonly props: ArbitraryTransformLoopProps;

  constructor(scope: Construct, id: string, props: ArbitraryTransformLoopProps) {
    super(scope, id);
    this.props = props;

    const { dataBucket, scriptBucket, glueDatabase, glueKmsKey, glueSecurityConfigurationName } =
      props.staticInfrastructureReferences;

    this.transformJobsAndCrawlers = new TransformJobsAndCrawlers(this, 'TransformJobsAndCrawlers', {
      dataProductUniqueIdentifier: props.dataProductUniqueIdentifier,
      dataBucketPath: props.dataBucketPath,
      dataBucket,
      dataProduct: props.dataProduct,
      database: glueDatabase,
      scriptBucket,
      glueKmsKey,
      glueSecurityConfigurationName,
      sourceAccessRole: props.sourceAccessRole,
      glueConnectionNames: props.glueConnectionNames,
      defaultTransformRequired: props.defaultTransformRequired,
      extraJobArgs: props.extraJobArgs,
    });
  }

  /**
   * Discover transforms, then loop over all transforms, executing the glue job, crawler and discovery for each.
   * Transforms may "fan-out" and produce multiple glue tables, each iteration applies transforms to all of the tables
   * in parallel.
   * @param onSuccess
   * @param additionalPayload
   */
  public executeAllTransformsAndCompleteStateMachine(
    onSuccess?: IChainable,
    additionalPayload?: { [key: string]: any },
  ): IChainable {
    const catchProps: CatchProps = {
      resultPath: JSON_PATH_AT.ERROR_DETAILS,
    };

    const { dataProduct, putErrorEventOnEventBridge, putSuccessEventOnEventBridge, staticInfrastructureReferences } =
      this.props;

    const {
      prepareTransformChainLambda,
      glueDBArn,
      prepareNextTransformLambda,
      crawlerStateMachine,
      getCrawledTableDetailsLambda,
      executeGeneratedQueryStateMachine,
      generatePIIQueryLambda,
      getPiiQueryResultLambda,
      athenaUtilitiesLambdaName,
      dataBucket,
    } = staticInfrastructureReferences;

    const prepareTransformChain = new LambdaInvoke(this, 'PrepareTransformChain', {
      lambdaFunction: prepareTransformChainLambda,
      payload: TaskInput.fromObject({
        Payload: {
          databaseName: glueDBArn.resourceName,
          tableDetails: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_DETAILS).value,
          tablePrefix: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_PREFIX).value,
          ingestionTimestamp: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__INGESTION_TIMESTAMP).value,
          transformJobs: this.transformJobsAndCrawlers.transformJobs,
          dataProduct,
          ...additionalPayload,
        },
      }),
    }).addCatch(putErrorEventOnEventBridge, catchProps);

    const prepareNextTransform = new LambdaInvoke(this, 'PrepareNextTransform', {
      lambdaFunction: prepareNextTransformLambda,
    }).addCatch(putErrorEventOnEventBridge, catchProps);

    const transformationsIterator = new Pass(this, 'StartTransformations');

    const transformCommonParameters = {
      transformJobs: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TRANSFORM_JOBS).value,
      transformJobIndex: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TRANSFORM_JOB_INDEX).value,
      transformJobCount: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TRANSFORM_JOB_COUNT).value,
      currentTransformJob: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__CURRENT_TRANSFORM_JOB).value,
      tableDetails: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_DETAILS).value,
      ingestionTimestamp: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__INGESTION_TIMESTAMP).value,
      dataProduct,
      ...additionalPayload,
    };

    const skipPiiDetection = new Pass(this, 'SkipPiiDetection', {
      parameters: {
        piiDetectionSkipped: true,
      },
    });

    const getPiiResultsFromAthena = new LambdaInvoke(this, 'GetPiiResultsFromAthena', {
      lambdaFunction: getPiiQueryResultLambda,
      payload: TaskInput.fromObject({
        Payload: {
          tableDetails: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_DETAILS).value,
          executePiiDetectionOutput: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__EXECUTE_PII_DETECTION_OUTPUT).value,
        },
      }),
      resultPath: JSON_PATH_AT.PAYLOAD__TABLE_DETAILS,
      payloadResponseOnly: true,
    });

    return prepareTransformChain.next(
      transformationsIterator.next(
        new Choice(this, 'IsTransformRemaining?')
          .when(
            Condition.numberLessThanJsonPath(
              JSON_PATH_AT.PAYLOAD__TRANSFORM_JOB_INDEX,
              JSON_PATH_AT.PAYLOAD__TRANSFORM_JOB_COUNT,
            ),
            new Map(this, 'RunTransformJobs', {
              itemsPath: JSON_PATH_AT.PAYLOAD__CURRENT_RESOLVED_TRANSFORM_JOBS,
              resultPath: JSON_PATH_AT.PAYLOAD__CURRENT_TRANSFORM_JOB_OUTPUTS,
            })
              .iterator(
                new GlueStartJobRun(this, 'RunTransformJob', {
                  glueJobName: TaskInput.fromJsonPathAt(JSON_PATH_AT.GLUE_JOB_NAME).value,
                  arguments: TaskInput.fromObject({
                    '--INPUT_TABLE_NAME': TaskInput.fromJsonPathAt(JSON_PATH_AT.INPUT_TABLE_NAME).value,
                    '--OUTPUT_S3_PATH': TaskInput.fromJsonPathAt(JSON_PATH_AT.OUTPUT_S3_TARGET_PATH).value,
                    '--DATABASE_NAME': glueDBArn.resourceName,
                    '--DOMAIN_ID': dataProduct.domainId,
                    '--DATA_PRODUCT_ID': dataProduct.dataProductId,
                    '--TEMP_S3_PATH': TaskInput.fromJsonPathAt(JSON_PATH_AT.TEMP_S3_PATH).value,
                  }),
                  integrationPattern: IntegrationPattern.RUN_JOB,
                  resultPath: JSON_PATH_AT.PAYLOAD__CURRENT_TRANSFORM_JOB_OUTPUT,
                }),
              )
              .addCatch(putErrorEventOnEventBridge, catchProps)
              .next(
                new StepFunctionsStartExecution(this, 'CrawlTransformOutput', {
                  stateMachine: crawlerStateMachine,
                  input: TaskInput.fromObject({
                    crawlerName: TaskInput.fromJsonPathAt(
                      JSON_PATH_AT.PAYLOAD__CURRENT_TRANSFORM_JOB__OUTPUT_CRAWLER_NAME,
                    ).value,
                  }),
                  integrationPattern: IntegrationPattern.RUN_JOB,
                  resultPath: JSON_PATH_AT.PAYLOAD__CURRENT_TRANFORM_CRAWL_OUTPUT,
                }).addCatch(putErrorEventOnEventBridge, catchProps),
              )
              .next(
                new LambdaInvoke(this, 'GetCrawledTransformOutputTableDetails', {
                  lambdaFunction: getCrawledTableDetailsLambda,
                  payload: TaskInput.fromObject({
                    Payload: {
                      databaseName: glueDBArn.resourceName,
                      tablePrefix: TaskInput.fromJsonPathAt(
                        JSON_PATH_AT.PAYLOAD__CURRENT_TRANSFORM_JOB__OUTPUT_CRAWLER_TABLE_PREFIX,
                      ).value,
                      ...transformCommonParameters,
                    },
                  }),
                }).addCatch(putErrorEventOnEventBridge, catchProps),
              )
              .next(prepareNextTransform)
              .next(transformationsIterator),
          )
          .otherwise(
            new Choice(this, 'IsAutomaticPiiEnabled?')
              .when(
                Condition.booleanEquals(JSON_PATH_AT.PAYLOAD__DATA_PRODUCT__ENABLE_AUTOMATIC_PII, true),
                new LambdaInvoke(this, 'GeneratePiiQuery', {
                  lambdaFunction: generatePIIQueryLambda,
                  payload: TaskInput.fromObject({
                    Payload: {
                      tableDetails: TaskInput.fromJsonPathAt(JSON_PATH_AT.PAYLOAD__TABLE_DETAILS).value,
                      athenaUtilitiesLambdaName,
                      databaseName: glueDBArn.resourceName,
                    },
                  }),
                  resultPath: JSON_PATH_AT.PAYLOAD__GENERATE_PII_QUERY_OUTPUT,
                  payloadResponseOnly: true,
                })
                  .addCatch(putErrorEventOnEventBridge, catchProps)
                  .next(
                    // new map
                    new Map(this, 'ExecutePiiQueryForAllTables', {
                      parameters: {
                        'contextIndex.$': '$$.Map.Item.Index',
                        'query.$': '$$.Map.Item.Value',
                        callingUser: this.props.callingUser,
                        // Write the pii detection query output to a subfolder in the data directory
                        outputS3Path: toS3Path({
                          bucket: dataBucket.bucketName,
                          key: s3PathJoin(dataProduct.domainId, dataProduct.dataProductId, '_pii-detection-output'),
                        }),
                      },
                      inputPath: JSON_PATH_AT.PAYLOAD__GENERATE_PII_QUERY_OUTPUT__PII_QUERY,
                      resultPath: JSON_PATH_AT.PAYLOAD__EXECUTE_PII_DETECTION_OUTPUT,
                    })
                      .iterator(
                        new Choice(this, 'IsQueryNotEmpty?')
                          .when(
                            Condition.not(Condition.stringEquals(JSON_PATH_AT.QUERY, '')),
                            new StepFunctionsStartExecution(this, 'ExecuteQueryForPIIDetection', {
                              stateMachine: executeGeneratedQueryStateMachine,
                              integrationPattern: IntegrationPattern.RUN_JOB,
                            }),
                          )
                          .otherwise(skipPiiDetection),
                      )
                      .addCatch(putErrorEventOnEventBridge, catchProps)
                      .next(getPiiResultsFromAthena.addCatch(putErrorEventOnEventBridge, catchProps)),
                  )
                  .next(onSuccess || putSuccessEventOnEventBridge),
              )
              .otherwise(onSuccess || putSuccessEventOnEventBridge),
          ),
      ),
    );
  }
}
