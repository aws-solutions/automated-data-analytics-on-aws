/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * define the list of default users
 */
export enum DefaultUser {
  SYSTEM = 'system',
}

/**
 * Event types events that can be sent about data products
 */
export enum DataProductEventDetailTypes {
  DATA_PRODUCT_IMPORT_START_FAILED = 'DataProductImportStartFailed',
  DATA_PRODUCT_ON_DEMAND_UPDATE = 'DataProductOnDemandUpdate',
  DATA_PRODUCT_IMPORT_SUCCESS = 'DataProductImportSuccess',
  DATA_PRODUCT_IMPORT_ERROR = 'DataProductImportError',
  DATA_PRODUCT_BUILD_ERROR = 'DataProductBuildError',
  DATA_PRODUCT_IMPORT_SUCCESS_NO_UPDATE = 'DataProductImportSuccessNoUpdate',
}

/**
 * Reserved dataProductIds
 */
export enum ReservedDataProducts {
  QUERIES = 'queries',
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
