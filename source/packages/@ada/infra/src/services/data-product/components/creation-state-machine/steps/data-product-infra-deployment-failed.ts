/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  DataProductEventDetailTypes,
  EventSource,
  buildErrorMessageFromStepFunctionErrorDetails,
} from '@ada/microservice-common';
import { DataProductInfraDeploymentFailedEvent } from './types';
import { DataProductInfrastructureStatus } from '@ada/common';
import { DataProductStore } from '../../ddb/data-product';
import { LockClient } from '../../../../api/components/entity/locks/client';
import { NotificationClient } from '../../../../api/components/notification/client';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Called when the creation of a data product fails due to an error in the step function state machine.
 * @param event step function failure event
 * @param context lambda context
 */
export const handler = async (event: DataProductInfraDeploymentFailedEvent, context: any) => {
  console.log('DataProductInfraDeploymentFailed', JSON.stringify(event), context);

  const {
    dataProduct: { dataProductId, domainId },
    callingUser: { userId },
  } = event.Payload;

  const lockClient = LockClient.getInstance('dataProductInfraDeploymentFailed');
  await lockClient.acquire(entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }));

  const dataProductStore = DataProductStore.getInstance();
  const updatedDataProduct = await dataProductStore.putDataProduct(domainId, dataProductId, userId, {
    ...(await dataProductStore.getDataProduct(domainId, dataProductId))!,
    infrastructureStatus: DataProductInfrastructureStatus.FAILED,
    infrastructureStatusDetails: buildErrorMessageFromStepFunctionErrorDetails(event.ErrorDetails),
  });

  await lockClient.releaseAll();

  await NotificationClient.getInstance().send({
    target: userId,
    source: EventSource.DATA_PRODUCTS,
    type: DataProductEventDetailTypes.DATA_PRODUCT_BUILD_ERROR,
    payload: {
      dataProduct: updatedDataProduct,
    },
  });
  return {};
};
