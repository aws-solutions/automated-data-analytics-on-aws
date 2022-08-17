/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceType } from '../core';
import { JsonSchema, S3Location, extendSchema } from '../../../api';

/**
 * The input details required for an s3 source data product
 */
export type SourceDetailsS3 = S3Location;

/**
 * The input details required for an s3 source data product
 */
export const SourceDetailsS3: JsonSchema = extendSchema( //NOSONAR (S2814:Duplicate) - false positive - type vs value
  {
    id: `${__filename}/SourceDetailsS3`,
  },
  S3Location,
);

const S3_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.S3,
  CONFIG: {
    enabled: true,
    supports: {
      preview: true,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: true,
        ON_DEMAND: true,
        SCHEDULE: true,
      },
      updateTriggerScheduleRate: {
        HOURLY: true,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: true,
      },
    },
  },
  SCHEMA: SourceDetailsS3,
};

export { S3_SOURCE_DEFINITION, S3_SOURCE_DEFINITION as default };
