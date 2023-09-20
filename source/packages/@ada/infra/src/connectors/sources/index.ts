/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/*
Register all connector sources in this module to bind to interface.

Source `index.ts` files must not import any cdk speciific modules as the
interface must be environment agnostic to allow proper tree-shaking.
*/

// ATTENTION: Order of import defines order in UI

export * as FileUpload from './file_upload';

export * as AmazonS3 from './amazon_s3';

export * as AmazonKinesis from './amazon_kinesis';

export * as GoogleAnalytics from './google_analytics';

export * as GoogleBigQuery from './google_bigquery';

export * as GoogleStorage from './google_storage';

export * as AmazonDynamoDB from './amazon_dynamodb';

export * as AmazonCloudWatch from './amazon_cloudwatch';

export * as AmazonRedshift from './amazon_redshift';

export * as MYSQL5 from './jdbc_mysql5';

export * as POSTGRESQL from './jdbc_postgresql';

export * as SQLSERVER from './jdbc_sqlserver';

export * as ORACLE from './jdbc_oracle';

export * as AmazonCloudTrail from './amazon_cloudtrail';

export * as MongoDB from './mongodb';
