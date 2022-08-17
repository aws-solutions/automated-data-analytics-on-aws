/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProduct } from '@ada/api';
import { DataProductStore } from '../../components/ddb/data-product';
import { entityIdentifier } from '@ada/api-client/types';
import { findKeysWithDifferentValues, isPermittedForFullAccessByDataProductPolicy } from '@ada/microservice-common';
import { relateDataProductWithOntologies } from './event-bridge/utils/data-set';

/**
 * The properties that may be updated on a data product to protect against modifying properties for an existing
 * data product that would alter the data product infrastructure.
 */
const PERMITTED_DATA_PRODUCT_UPDATE_PROPERTIES: Set<string> = new Set<keyof DataProduct>([
  'dataProductId', // The id is specified as a path parameter so it's ok if it's missing/different in the body of an update request
  'name',
  'description',
  'dataSets',
  'tags',
]);

/**
 * Handler for updating a data product
 */
export const handler = ApiLambdaHandler.for(
  'putDataProductDomainDataProduct',
  async ({ requestParameters, body: dataProductInput }, callingUser, _event, { relationshipClient, lockClient }) => {
    const { domainId, dataProductId } = requestParameters;
    const { userId } = callingUser;
    const dataProductStore = DataProductStore.getInstance();

    const dataProductToWrite: DataProduct = {
      ...dataProductInput,
      childDataProducts: dataProductInput.childDataProducts || [],
      parentDataProducts: dataProductInput.parentDataProducts || [],
      domainId,
      dataProductId,
      dataSets: dataProductInput.dataSets || {},
    };

    const api = ApiClient.create(callingUser);

    // Retrieve an existing data product if any
    const existingDataProduct = await dataProductStore.getDataProduct(domainId, dataProductId);

    if (!existingDataProduct) {
      return ApiResponse.notFound({ message: `No data product found with id ${dataProductId} in domain ${domainId}` });
    }

    // Validate that only permitted properties are being updated - ie don't support update of source type and
    // other details related to fundamental infrastructure for data product
    const differingProperties = findKeysWithDifferentValues(dataProductToWrite, existingDataProduct);
    const forbiddenProperties = differingProperties.filter(
      (updatedProperty) => !PERMITTED_DATA_PRODUCT_UPDATE_PROPERTIES.has(updatedProperty),
    );
    if (forbiddenProperties.length > 0) {
      return ApiResponse.badRequest({
        message: `Modifying the following properties of a data product is forbidden: ${forbiddenProperties.join(
          ', ',
        )}. Consider creating a new data product.`,
      });
    }

    const policy = await api.getGovernancePolicyDomainDataProduct({
      domainId,
      dataProductId,
    });
    if (policy && !isPermittedForFullAccessByDataProductPolicy(policy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Not authorized to update permissions for data product ${domainId}.${dataProductId}`,
      });
    }

    // Optimistically lock the domain
    const domainEntityIdentifier = entityIdentifier('DataProductDomain', { domainId });
    await lockClient.acquire(domainEntityIdentifier);

    // Write the data product to the store
    const writtenDataProduct = await dataProductStore.putDataProduct(domainId, dataProductId, userId, {
      ...existingDataProduct,
      ...dataProductToWrite,
    });

    // Relate the data product to the ontologies it references
    await relateDataProductWithOntologies(callingUser, api, writtenDataProduct, lockClient, relationshipClient);

    // Creating a data product policy will lock the data product, so we release our locks early
    await lockClient.releaseAll();

    return ApiResponse.success(writtenDataProduct);
  },
);
