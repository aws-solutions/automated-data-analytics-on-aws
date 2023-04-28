/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const PATTERN_DYNAMODB_TABLE_ARN = /^arn:aws:dynamodb:([a-z])+-([a-z])+-\d:\d+:table\/([A-Za-z0-9-]+)$/;

export const PATTERN_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/([A-Za-z0-9-]+)$/;

export const DDB_AUTO_EVENT_SOURCE = 'ada.ddb.automatic';

export const DDB_AUTO_EVENT_DETAIL_TYPE = 'DynamoDB Stream Lambda Trigger';
