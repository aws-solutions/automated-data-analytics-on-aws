/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export enum JSON_PATH_AT {
  PAYLOAD__TABLE_DETAILS = '$.Payload.tableDetails',
  PAYLOAD__TABLE_PREFIX = '$.Payload.tablePrefix',
  PAYLOAD__INGESTION_TIMESTAMP = '$.Payload.ingestionTimestamp',
  PAYLOAD__DROP_TABLE_QUERIES = '$.Payload.dropTableQueries',
  PAYLOAD__TRANSFORM_JOBS = '$.Payload.transformJobs',
  PAYLOAD__TRANSFORM_JOB_INDEX = '$.Payload.transformJobIndex',
  PAYLOAD__TRANSFORM_JOB_COUNT = '$.Payload.transformJobCount',
  PAYLOAD__DATA_PRODUCT__ENABLE_AUTOMATIC_PII = '$.Payload.dataProduct.enableAutomaticPii',
  PAYLOAD__CURRENT_TRANSFORM_JOB = '$.Payload.currentTransformJob',
  PAYLOAD__CURRENT_TRANSFORM_JOB__OUTPUT_CRAWLER_TABLE_PREFIX = '$.Payload.currentTransformJob.outputCrawlerTablePrefix',
  PAYLOAD__CURRENT_TRANSFORM_JOB__OUTPUT_CRAWLER_NAME = '$.Payload.currentTransformJob.outputCrawlerName',
  PAYLOAD__CURRENT_TRANSFORM_JOB_OUTPUTS = '$.Payload.currentTransformJobOutputs',
  PAYLOAD__CURRENT_TRANSFORM_JOB_OUTPUT = '$.Payload.currentTransformJobOutput',
  PAYLOAD__CURRENT_TRANFORM_CRAWL_OUTPUT = '$.Payload.currentTransformCrawlOutput',
  PAYLOAD__CURRENT_RESOLVED_TRANSFORM_JOBS = '$.Payload.currentResolvedTransformJobs',
  PAYLOAD__EXECUTE_PII_DETECTION_OUTPUT = '$.Payload.executePiiDetectionOutput',
  PAYLOAD__GENERATE_PII_QUERY_OUTPUT = '$.Payload.generatePiiQueryOutput',
  PAYLOAD__GENERATE_PII_QUERY_OUTPUT__PII_QUERY = '$.Payload.generatePiiQueryOutput.piiQuery',

  GLUE_JOB_NAME = '$.glueJobName',
  INPUT_TABLE_NAME = '$.inputTableName',
  OUTPUT_S3_TARGET_PATH = '$.outputS3TargetPath',
  TEMP_S3_PATH = '$.tempS3Path',
  ERROR_DETAILS = '$.ErrorDetails',
  QUERY = '$.query',

  CTAS_QUERY = '$.Payload.ctasQuery',

  CLEAN_TABLES_OUTPUT = '$.CleanTablesOutput',

  QUERY_OUTPUT = '$.QueryOutput',
  QUERY_OUTPUT__OUTPUT__ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE = '$.QueryOutput.Output.athenaStatus.QueryExecution.Status.State',
  QUERY_OUTPUT__OUTPUT__ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE_CHANGE_REASON = '$.QueryOutput.Output.athenaStatus.QueryExecution.Status.StateChangeReason',

  CRAWL_OUTPUT = '$.CrawlerOutput',
  CRAWL_OUTPUT__OUTPUT__PAYLOAD__STATUS = '$.CrawlerOutput.Output.Payload.status',

  ATHENA_STATUS__QUERY_EXECUTION__STATUS__STATE = '$.athenaStatus.QueryExecution.Status.State',
}
