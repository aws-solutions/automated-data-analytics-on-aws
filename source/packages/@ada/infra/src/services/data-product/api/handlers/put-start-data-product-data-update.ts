/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductStartDataUpdateStatus, triggerDataProductDataUpdate } from '../../dynamic-infrastructure/events';

/**
 * Handler for starting an on-demand data update for a data product
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putDataProductDomainDataProductStartDataUpdate',
  async ({ requestParameters }, { userId }) => {
    const { domainId, dataProductId } = requestParameters;

    const result = await triggerDataProductDataUpdate(domainId, dataProductId, userId);

    switch (result.status) {
      case DataProductStartDataUpdateStatus.NOT_FOUND:
        return ApiResponse.notFound({
          message: `Not Found: no dataProduct was found with domainId ${domainId} and dataProductId ${dataProductId}`,
        });
      case DataProductStartDataUpdateStatus.ALREADY_UPDATING:
        return ApiResponse.badRequest({
          message: `Cannot trigger a new data update while one is in progress`,
        });
      default:
        return ApiResponse.success(result.dataProduct!);
    }
  },
);
