/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceType } from '../../core';
import { GoogleServiceAccountAuth } from './common';
import { JsonSchema, JsonSchemaType, JsonSchemaVersion, asRef } from '../../../../api';

export interface GoogleBigQueryTableIdentifier {
  query: string;
}

export const GoogleBigQueryTableIdentifier: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/GoogleBigQueryTableIdentifier`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    query: { type: JsonSchemaType.STRING },
  },
  required: ['query'],
};

export interface SourceDetailsGoogleBigQuery extends GoogleServiceAccountAuth, GoogleBigQueryTableIdentifier {}

/**
 * Input details required for a google analytics source data product
 */
export const SourceDetailsGoogleBigQuery: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/SourceDetailsGoogleBigQuery`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  allOf: [
    asRef(GoogleBigQueryTableIdentifier),
    asRef(GoogleServiceAccountAuth),
  ],
  definitions: {
    GoogleBigQueryTableIdentifier,
    GoogleServiceAccountAuth,
  },
};

const GOOGLE_BIGQUERY_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.GOOGLE_BIGQUERY,
  CONFIG: {
    enabled: true,
    supports: {
      preview: true,
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
  SCHEMA: SourceDetailsGoogleBigQuery,
};

export { GOOGLE_BIGQUERY_SOURCE_DEFINITION, GOOGLE_BIGQUERY_SOURCE_DEFINITION as default };
