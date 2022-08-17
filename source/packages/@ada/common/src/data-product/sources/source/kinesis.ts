/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ARN_RESOURCE_VALIDATION, JsonSchema, JsonSchemaType, JsonSchemaVersion } from '../../../api';
import { DataProductSourceDefinition, SourceType } from '../core';

/**
 * Input details required for a kinesis source data product
 */
export interface SourceDetailsKinesis {
  kinesisStreamArn: string;
}

/**
 * Input details required for a kinesis source data product
 */
export const SourceDetailsKinesis: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/SourceDetailsKinesis`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    kinesisStreamArn: { type: JsonSchemaType.STRING, ...ARN_RESOURCE_VALIDATION },
  },
  required: ['kinesisStreamArn'],
};

const KINESIS_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.KINESIS,
  CONFIG: {
    enabled: true,
    supports: {
      preview: false,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: true,
        ON_DEMAND: false,
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
  SCHEMA: SourceDetailsKinesis,
};

export { KINESIS_SOURCE_DEFINITION, KINESIS_SOURCE_DEFINITION as default };
