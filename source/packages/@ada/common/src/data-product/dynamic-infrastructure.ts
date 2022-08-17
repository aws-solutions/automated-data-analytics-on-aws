/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * All cloud formation stacks deployed for data products must have this prefix
 */
export const DATA_PRODUCT_CLOUD_FORMATION_STACK_NAME_PREFIX = 'ada-dp-';

/**
 * Prefix for the dynamic infrastructure cloud formation stack's output containing the data import state machine arn
 */
export const DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX = 'DataImportStateMachineArn-';

/**
 * Key for partitions created when appending new data to a data product
 */
export const DATA_PRODUCT_APPEND_DATA_PARTITION_KEY = 'ada_____partition';

/**
 * Possible statuses of data product infrastructure
 */
export enum DataProductInfrastructureStatus {
  PROVISIONING = 'PROVISIONING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Possible statuses of data product data
 */
export enum DataProductDataStatus {
  NO_DATA = 'NO_DATA',
  UPDATING = 'UPDATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Possible statuses of raw data product source data
 */
export enum DataProductSourceDataStatus {
  NO_DATA = 'NO_DATA',
  UPDATING = 'UPDATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum DataSetIds {
  DEFAULT = 'ada_default_dataset',
}
