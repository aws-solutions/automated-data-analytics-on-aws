/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { CallingUser } from '@ada/common';
import { DataProduct } from '@ada/api-client';
import { DataProductStore, ListDataProductsResponse } from '../../components/ddb/data-product';
import { isPermittedForReadAccessByDataProductPolicy } from '@ada/microservice-common';
import chunk from 'lodash/chunk';

const DATA_PRODUCT_POLICY_BATCH_SIZE = 20;

/**
 * Filters the given data product list to only data products where the calling user has access according to the data
 * product policy
 * @param response list data products response
 * @param callingUser the user listing data products
 */
const filterDataProductsWithReadAccess = async (
  response: ListDataProductsResponse,
  callingUser: CallingUser,
): Promise<ListDataProductsResponse> => {
  const api = ApiClient.create(callingUser);
  const permittedDataProducts: DataProduct[] = [];

  // Fetch data product policies in parallel batches
  for (const batch of chunk(response.dataProducts, DATA_PRODUCT_POLICY_BATCH_SIZE)) {
    permittedDataProducts.push(
      ...(
        await Promise.all(
          batch.map(async (dataProduct) => {
            const { domainId, dataProductId } = dataProduct;
            const policy = await api.getGovernancePolicyDomainDataProduct({ domainId, dataProductId });
            return isPermittedForReadAccessByDataProductPolicy(policy, callingUser) ? [dataProduct] : [];
          }),
        )
      ).flat(),
    );
  }

  // NOTE: Consider fetching more pages if we filtered out data products here to honour the original pagination parameters
  return {
    ...response,
    dataProducts: permittedDataProducts,
  };
};

/**
 * Handler for listing data products
 */
export const handler = ApiLambdaHandler.for(
  'listDataProductDomainDataProducts',
  async ({ requestParameters }, callingUser) => {
    const paginationParameters = getPaginationParameters(requestParameters);
    const { domainId } = requestParameters;

    const response = await DataProductStore.getInstance().listDataProducts(domainId, paginationParameters);
    if (response.error) {
      return ApiResponse.badRequest({ message: response.error });
    }

    return ApiResponse.success(await filterDataProductsWithReadAccess(response, callingUser));
  },
);
