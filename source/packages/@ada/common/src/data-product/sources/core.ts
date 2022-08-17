/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema } from '../../api/json-schema';

/**
 * The type of data product source.
 * @disclaimer Order is important as will define order within UI.
 */
export enum SourceType {
  UPLOAD = 'UPLOAD',
  /** @deprecated removed from MVP */
  QUERY = 'QUERY',

  S3 = 'S3',
  KINESIS = 'KINESIS',

  GOOGLE_ANALYTICS = 'GOOGLE_ANALYTICS',
  GOOGLE_BIGQUERY = 'GOOGLE_BIGQUERY',
  GOOGLE_STORAGE = 'GOOGLE_STORAGE',

  // Add additional source types here when supported
}

/**
 * Trigger types for a data product data.
 * @disclaimer Order is important as will define order within UI.
 */
export enum DataProductUpdateTriggerType {
  ON_DEMAND = 'ON_DEMAND',
  SCHEDULE = 'SCHEDULE',
  AUTOMATIC = 'AUTOMATIC',
}

export type UpdateTriggerType = keyof typeof DataProductUpdateTriggerType;

/**
 * Update types for a data product data
 */
export enum DataProductUpdatePolicy {
  APPEND = 'APPEND',
  REPLACE = 'REPLACE',
}

/**
 * When the data product is updated and the query is rerun...
 *
 * APPEND: Results are appended to the existing data product data
 * REPLACE: Previous data is discarded and replaced with the latest results
 */
export type SourceUpdatePolicy = keyof typeof DataProductUpdatePolicy;

/**
 * Frequencies supported for schedule update trigger.
 */
export enum DataProductUpdateTriggerScheduleRate {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export type UpdateTriggerScheduleRate = keyof typeof DataProductUpdateTriggerScheduleRate;

/**
 * Configuration settings for specific data product source type
 */
export interface DataProductSourceDefinitionConfig {
  /** Indicates if source type is current enabled */
  enabled: boolean;
  /** Mapping of features/functionality this source type supports */
  supports: {
    /**
     * Indicates if the source type supports schema preview during creation.
     */
    preview: boolean;
    /**
     * Indicates if the source type support automatic transforms.
     */
    automaticTransforms: boolean;
    /**
     * Indicates if the source type support custom transforms.
     */
    customTransforms: boolean;
    /**
     * Indicates what types of update triggers to source supports.
     * If `false` the source does not support updates after initial import.
     * Otherwise is explicit map of supported triggers.
     */
    updateTriggers: false | Record<DataProductUpdateTriggerType, boolean>;
    /**
     * Indicates update trigger schedules supported by the source.
     * If `false` then source does not support scheduling.
     * Otherwise is explicit map of available scheduling options.
     */
    updateTriggerScheduleRate: null | Record<UpdateTriggerScheduleRate, boolean>;
  };
}

export interface DataProductSourceDefinition {
  TYPE: SourceType;
  SCHEMA: JsonSchema;
  CONFIG: DataProductSourceDefinitionConfig;
}
