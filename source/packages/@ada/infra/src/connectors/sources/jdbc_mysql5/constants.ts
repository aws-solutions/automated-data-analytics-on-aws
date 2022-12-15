/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const PATTERN_RDS_ENDPOINT = /^[\w.]+\.rds.amazonaws.com/;

export const PATTERN_NOT_EMPTY = /^[\w.-]+$/;

export const PATTERN_MYSQL_USERNAME = /^[\w.\-@]+$/;

// port 0 - 65535
export const PATTERN_DB_PORT =
  /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;

export const TEXT_FIELD = 'text-field';

export const SELECT_FIELD = 'select';
