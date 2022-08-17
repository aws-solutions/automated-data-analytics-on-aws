/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GOOGLE_ANALYTICS_SOURCE_UX, GOOGLE_BIGQUERY_SOURCE_UX, GOOGLE_STORAGE_SOURCE_UX } from './google';
import { KINESIS_SOURCE_UX } from './kinesis';
import { S3_SOURCE_UX } from './s3';
import { SourceType } from '@ada/common';
import { UPLOAD_SOURCE_UX } from './file-upload';
import { UXDataProductSourceDefinition } from './common';

export * from './common';

export * from './file-upload';
export * from './google';
export * from './kinesis';
export * from './s3';

export type UXDataProductSourceTypes = Exclude<SourceType, 'QUERY'>;

/**
 * @disclaimer Order is important as will define UI sort order
 */
export const UXDataProductSources: Record<UXDataProductSourceTypes, UXDataProductSourceDefinition<any>> = {
  // internal
  UPLOAD: UPLOAD_SOURCE_UX,

  // aws
  S3: S3_SOURCE_UX,
  KINESIS: KINESIS_SOURCE_UX,

  // google
  GOOGLE_ANALYTICS: GOOGLE_ANALYTICS_SOURCE_UX,
  GOOGLE_BIGQUERY: GOOGLE_BIGQUERY_SOURCE_UX,
  GOOGLE_STORAGE: GOOGLE_STORAGE_SOURCE_UX,
};
