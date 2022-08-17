/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DATE_VALIDATION, JsonSchema, JsonSchemaType, JsonSchemaVersion, asRef } from '../../../../api';
import { DataProductSourceDefinition, SourceType } from '../../core';
import { GoogleServiceAccountAuth } from './common';

export interface GoogleAnalyticsIdentifier {
  viewId: string;
  dimensions: string;
  metrics: string;
  since?: string;
  until?: string;
  scheduleRate?: string;
  neverEnd?: boolean; // currently defaults to true
}

// https://regexr.com/6f5bu
export const GA_KV_REGEX = /^(ga:[a-zA-Z0-9]+,?)+$/;

export const GA_KV_VALIDATION: Partial<JsonSchema> = {
  pattern: GA_KV_REGEX.source,
  minLength: 4,
  maxLength: 20480, // roughly 3x of all current metrics/dimensions in ga
};

export const GoogleAnalyticsIdentifier: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/GoogleAnalyticsIdentifier`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    viewId: { type: JsonSchemaType.STRING },
    since: { type: JsonSchemaType.STRING, ...DATE_VALIDATION },
    until: { type: JsonSchemaType.STRING, ...DATE_VALIDATION },
    dimensions: { type: JsonSchemaType.STRING, ...GA_KV_VALIDATION },
    metrics: { type: JsonSchemaType.STRING, ...GA_KV_VALIDATION },
    scheduleRate: { type: JsonSchemaType.STRING },
  },
  required: ['viewId', 'dimensions', 'metrics'],
};

/**
 * Source details for google analytics
 */
export interface SourceDetailsGoogleAnalytics extends GoogleAnalyticsIdentifier, GoogleServiceAccountAuth {}

/**
 * Input details required for a google analytics source data product
 */
export const SourceDetailsGoogleAnalytics: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/SourceDetailsGoogleAnalytics`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  allOf: [
    asRef(GoogleAnalyticsIdentifier),
    asRef(GoogleServiceAccountAuth),
  ],
  definitions: {
    GoogleAnalyticsIdentifier,
    GoogleServiceAccountAuth,
  },
};

const GOOGLE_ANALYTICS_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.GOOGLE_ANALYTICS,
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
        HOURLY: false,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: true,
      },
    },
  },
  SCHEMA: SourceDetailsGoogleAnalytics,
};

export { GOOGLE_ANALYTICS_SOURCE_DEFINITION, GOOGLE_ANALYTICS_SOURCE_DEFINITION as default };
