/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import { DataProduct } from '@ada/api-client';
import {
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductSourceDataStatus,
  DataProductUpdateTriggerType,
} from '@ada/common';
import { isEmpty } from 'lodash';

const DEFAULT_STATE: DataProductState = {
  // infra
  isProvisioning: false,
  isProvisioned: false,
  hasProvisioningFailed: false,
  infra: {},

  // source data
  isSourceDataSupported: false,
  isSourceDataReady: false,
  isSourceUpdating: false,
  hasSourceDataFailed: false,
  isMissingSourceData: false,
  isSourceQueryable: false,
  source: {},

  // data
  isImporting: false,
  hasImportingFailed: false,
  isMissingData: false,
  data: {},

  // aggregates
  hasSchema: false,
  isReady: false,
  hasFailed: false,
  isProcessing: false,
  isQueryable: false,
  onDemandUpdateSupported: false,
  onDemandUpdateAvailable: false,
};

export interface DataProductState {
  // infra
  readonly isProvisioning: boolean;
  readonly isProvisioned: boolean;
  readonly hasProvisioningFailed: boolean;
  readonly infra: {
    status?: DataProductInfrastructureStatus;
    details?: DataProduct['infrastructureStatusDetails'];
  };

  // source data
  readonly isSourceDataSupported: boolean;
  readonly isSourceDataReady: boolean;
  readonly isSourceUpdating: boolean;
  readonly isMissingSourceData: boolean;
  readonly hasSourceDataFailed: boolean;
  readonly isSourceQueryable: boolean;
  readonly source: {
    status?: DataProductSourceDataStatus;
    details?: DataProduct['sourceDataStatusDetails'];
  };

  // data
  readonly isImporting: boolean;
  readonly hasImportingFailed: boolean;
  readonly isMissingData: boolean;
  readonly data: {
    status?: DataProductDataStatus;
    details?: DataProduct['dataStatusDetails'];
  };

  // aggregate
  readonly hasSchema: boolean;
  readonly isReady: boolean;
  readonly hasFailed: boolean;
  readonly isProcessing: boolean;
  readonly isQueryable: boolean;
  /** Indicates if OnDemand update is supported for this data product, based on source type and trigger type */
  readonly onDemandUpdateSupported: boolean;
  /** Indicates if based on current state OnDemand update is available to trigger */
  readonly onDemandUpdateAvailable: boolean;
}

export function getDataProductState(dataProduct?: DataProduct): DataProductState {
  if (dataProduct == null) return DEFAULT_STATE;

  // infra
  const infraStatus = dataProduct.infrastructureStatus as DataProductInfrastructureStatus;
  const isProvisioned = infraStatus === DataProductInfrastructureStatus.READY;
  const isProvisioning = infraStatus === DataProductInfrastructureStatus.PROVISIONING;
  const hasProvisioningFailed = infraStatus === DataProductInfrastructureStatus.FAILED;

  // source data
  const sourceDataStatus = dataProduct.sourceDataStatus as DataProductSourceDataStatus;
  const isSourceDataSupported = Connectors.CATEGORIES.SOURCE_QUERY_ENABLED_CONNECTORS.has(dataProduct.sourceType);
  const isSourceDataReady = sourceDataStatus === DataProductSourceDataStatus.READY;
  const isSourceUpdating = sourceDataStatus === DataProductSourceDataStatus.UPDATING;
  const isMissingSourceData = sourceDataStatus === DataProductSourceDataStatus.NO_DATA;
  const hasSourceDataFailed = sourceDataStatus === DataProductSourceDataStatus.FAILED;
  const isSourceQueryable = isSourceDataReady;

  // data
  const dataStatus = dataProduct.dataStatus as DataProductDataStatus;
  const isDataReady = dataStatus === DataProductDataStatus.READY;
  const isImporting = dataStatus === DataProductDataStatus.UPDATING;
  const isMissingData = dataStatus === DataProductDataStatus.NO_DATA;
  const hasImportingFailed = dataStatus === DataProductDataStatus.FAILED;

  const hasFailed = hasProvisioningFailed || hasImportingFailed || hasSourceDataFailed;
  const isReady = isProvisioned && isDataReady;
  const isProcessing = isProvisioning || isImporting;
  const isQueryable = isReady || (isProvisioned && dataProduct.latestDataUpdateTimestamp != null);
  const onDemandUpdateSupported =
    dataProduct.sourceType !== Connectors.Id.UPLOAD &&
    dataProduct.updateTrigger.triggerType === DataProductUpdateTriggerType.ON_DEMAND;
  const onDemandUpdateAvailable = onDemandUpdateSupported && isReady && !isProcessing && !isImporting;
  const hasSchema = !(isEmpty(dataProduct.dataSets) && isEmpty(dataProduct.sourceDataSets));

  return {
    // infra
    isProvisioned,
    isProvisioning,
    hasProvisioningFailed,
    infra: {
      status: infraStatus,
      details: dataProduct.infrastructureStatusDetails,
    },

    // source data
    isSourceDataSupported,
    isSourceDataReady,
    isSourceUpdating,
    isMissingSourceData,
    hasSourceDataFailed,
    isSourceQueryable,
    source: {
      status: sourceDataStatus,
      details: dataProduct.sourceDataStatusDetails,
    },

    // data
    isImporting,
    isMissingData,
    hasImportingFailed,
    data: {
      status: dataStatus,
      details: dataProduct.dataStatusDetails,
    },

    // aggregate
    hasSchema,
    isReady,
    hasFailed,
    isProcessing,
    isQueryable,
    onDemandUpdateSupported,
    onDemandUpdateAvailable,
  };
}
