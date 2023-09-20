/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const PATTERN_NOT_EMPTY = /^[\w.-]+$/;

export const PATTERN_REDSHIFT_HOST = /^[\w.-]+\.redshift.*\.amazonaws\.com$/;

// port 0 - 65535
export const PATTERN_DB_PORT =
  /^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;

export const TEXT_FIELD = 'text-field';

export const PATTERN_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/([A-Za-z0-9-]+)$/;