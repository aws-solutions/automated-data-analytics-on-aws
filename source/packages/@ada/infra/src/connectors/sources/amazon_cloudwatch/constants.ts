/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const PATTERN_LOGGROUP_ARN = /^arn:aws:logs:[\w-]+:\d+:log-group:[\w/-]+:\*$/;
export const PATTERN_QUERY = /[\S\s]+\S+/;
export const PATTERN_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/([A-Za-z0-9-]+)$/;
export const TEXT_FIELD = 'text-field'