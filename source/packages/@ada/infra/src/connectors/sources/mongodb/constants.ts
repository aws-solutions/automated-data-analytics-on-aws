/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const PATTERN_S3_HTTP_URI = /^(s3|https?|http):\/\/[^\s/$.?#].[^\s]*$/;

export const PATTERN_NOT_EMPTY = /^[\w.-]+$/;

// port 0 - 65535
export const PATTERN_DB_PORT =
  /^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;

export const TEXT_FIELD = 'text-field';

export const SELECT_FIELD = 'select';

export const TEXT_AREA = 'textarea';

export const CHECKBOX_FIELD = 'checkbox';

export const SOURCE_DETAILS_TLS = 'sourceDetails.tls'