/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceType } from '../../core';
import { GSLocation, JsonSchema, JsonSchemaType, JsonSchemaVersion, asRef } from '../../../../api';
import { GoogleServiceAccountAuth } from './common';

/**
 * Source details for google storage
 */
export interface SourceDetailsGoogleStorage extends GSLocation, GoogleServiceAccountAuth {}

/**
 * Input details required for a google storage source data product
 */
export const SourceDetailsGoogleStorage: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/SourceDetailsGoogleStorage`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  allOf: [
    asRef(GSLocation),
    asRef(GoogleServiceAccountAuth),
  ],
  definitions: {
    GSLocation,
    GoogleServiceAccountAuth,
  },
};

const GOOGLE_STORAGE_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.GOOGLE_STORAGE,
  CONFIG: {
    enabled: true,
    supports: {
      preview: false,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: false,
        ON_DEMAND: true,
        SCHEDULE: true,
      },
      updateTriggerScheduleRate: {
        HOURLY: true,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: false,
      },
    },
  },
  SCHEMA: SourceDetailsGoogleStorage,
};

export { GOOGLE_STORAGE_SOURCE_DEFINITION, GOOGLE_STORAGE_SOURCE_DEFINITION as default };
