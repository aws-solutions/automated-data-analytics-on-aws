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
}

/**
 * Reserved dataProductIds
 */
export enum ReservedDataProducts {
  QUERIES = 'queries',
}
