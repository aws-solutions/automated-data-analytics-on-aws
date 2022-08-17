/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProduct, DataProductIdentifier } from '@ada/api';
import { DataProductDataStatus } from '@ada/common';
import { DataProductEventDetailTypes, EventSource } from '../../../common/services';
import { DataProductStore } from '../components/ddb/data-product';
import { NotificationClient } from '../../api/components/notification/client';

/**
 * Possible result types from attempting to start a data product data update workflow
 */
export enum DataProductStartDataUpdateStatus {
  NOT_FOUND,
  ALREADY_UPDATING,
  SUCCESS,
}

/**
 * Result from triggering a data product data update workflow
 */
export interface DataProductStartDataUpdateResult {
  status: DataProductStartDataUpdateStatus;
  dataProduct?: DataProduct;
}

/**
 * Send an event to eventbridge to trigger an on-demand update for the given data product
 * @param domainId id of the domain of the data product
 * @param dataProductId the id of the data product to start the data update for
 */
const sendOnDemandUpdateEvent = ({ domainId, dataProductId }: DataProductIdentifier) =>
  NotificationClient.getInstance().send({
    source: EventSource.DATA_PRODUCTS,
    type: DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE,
    payload: { domainId, dataProductId },
  });

/**
 * Start a data product data update
 * @param domainId the domain in which the data product resides
 * @param dataProductId the data product to start the data update for
 * @param userId the user triggering the data product data update
 */
export const triggerDataProductDataUpdate = async (
  domainId: string,
  dataProductId: string,
  userId: string,
): Promise<DataProductStartDataUpdateResult> => {
  const dataProductStore = DataProductStore.getInstance();
  const dataProduct = await dataProductStore.getDataProduct(domainId, dataProductId);
  if (!dataProduct) {
    return { status: DataProductStartDataUpdateStatus.NOT_FOUND };
  }

  if (dataProduct.dataStatus === DataProductDataStatus.UPDATING) {
    return { status: DataProductStartDataUpdateStatus.ALREADY_UPDATING };
  }

  // Start the data product data update
  await sendOnDemandUpdateEvent({ domainId, dataProductId });

  // Write the new status to indicate we've started the update
  const writtenDataProduct = await dataProductStore.putDataProduct(domainId, dataProductId, userId, {
    ...dataProduct,
    dataStatus: DataProductDataStatus.UPDATING,
  });

  return { status: DataProductStartDataUpdateStatus.SUCCESS, dataProduct: writtenDataProduct };
};
