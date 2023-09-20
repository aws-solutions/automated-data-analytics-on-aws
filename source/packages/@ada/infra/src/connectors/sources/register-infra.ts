/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable */
import './index';

/*
	Register all source infra in this module, which is used to decouple cdk infra resources
	from environment agnostic connector interface.
*/
import './amazon_kinesis/infra/register';
import './amazon_s3/infra/register';
import './file_upload/infra/register';
import './google_analytics/infra/register';
import './google_bigquery/infra/register';
import './google_storage/infra/register';
import './amazon_dynamodb/infra/register';
import './amazon_cloudwatch/infra/register';
import './amazon_redshift/infra/register';
import './jdbc_mysql5/infra/register';
import './jdbc_postgresql/infra/register';
import './jdbc_sqlserver/infra/register';
import './jdbc_oracle/infra/register';
import './amazon_cloudtrail/infra/register';
import './mongodb/infra/register';
