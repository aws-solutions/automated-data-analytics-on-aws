/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProduct } from '@ada/api';
import {
  DataProductAccess,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductSourceDataStatus,
  DefaultGroupIds,
  ReservedDataProducts,
  ReservedDomains,
} from '@ada/common';
import { DataProductStore } from '../../components/ddb/data-product';
import {
  createSecret,
  getSecretToStore,
  requireSecret,
  updateDataProductSecretDetails,
} from '../../components/secrets-manager/data-product';
import { entityIdentifier } from '@ada/api-client/types';
import { isEqual, uniqWith } from 'lodash';
import { isRawSourceSupported, startBuildDataProductSchemaAndSource } from './build-data-product';
import { relateDataProductWithOntologies } from './event-bridge/utils/data-set';
import { startDynamicInfrastructureCreation } from '../../dynamic-infrastructure/state-machine';
import VError from 'verror';

const RESERVED_DATA_PRODUCTS = new Set<string>(Object.values(ReservedDataProducts));

/**
 * Handler for creating a data product
 */
export const handler = ApiLambdaHandler.for(
  'postDataProductDomainDataProduct',
  async (
    { requestParameters, requestArrayParameters, body: dataProductInput },
    callingUser,
    _event,
    { relationshipClient, lockClient },
  ) => {
    const { domainId, dataProductId } = requestParameters;
    const { initialFullAccessGroups } = requestArrayParameters;
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

    if (existingDataProduct) {
      return ApiResponse.badRequest({
        message: `A data product with id ${dataProductId} in domain ${domainId} already exists`,
      });
    }

    if (RESERVED_DATA_PRODUCTS.has(dataProductId)) {
      return ApiResponse.badRequest({
        message: `Cannot create a data product with reserved dataProductId ${dataProductId}`,
      });
    }

    const inlineScriptTransforms = dataProductToWrite.transforms.filter(
      ({ inlineScriptContent }) => inlineScriptContent,
    );
    if (inlineScriptTransforms.length > 0) {
      return ApiResponse.badRequest({
        message: `Inline scripts are for schema preview only and cannot be used in a data product. Please save the scripts first.`,
        details: `Found inline scripts with ids: ${inlineScriptTransforms.map(({ scriptId }) => scriptId).join(', ')}`,
      });
    }

    const crossDomainScriptReferences = dataProductToWrite.transforms.filter(
      ({ namespace }) => ![domainId, ReservedDomains.GLOBAL].includes(namespace),
    );
    if (crossDomainScriptReferences.length > 0) {
      const scriptNames = crossDomainScriptReferences
        .map(({ namespace, scriptId }) => `${namespace}.${scriptId}`)
        .join(', ');
      return ApiResponse.badRequest(
        new VError(
          {
            name: 'CrossDomainScriptReferencesError',
          },
          `Only global scripts or scripts namespaced to the data product's domain can be used by a data product. Found transform scripts: ${scriptNames}`,
        ),
      );
    }

    if (requireSecret(dataProductToWrite)) {
      const secret = getSecretToStore(dataProductToWrite);
      const result = await createSecret(secret.key, secret.value);

      updateDataProductSecretDetails(result.Name!, dataProductToWrite);
    }

    // Optimistically lock the domain
    const domainEntityIdentifier = entityIdentifier('DataProductDomain', { domainId });
    await lockClient.acquire(domainEntityIdentifier);

    // Ensure the domain exists if adding a new data product
    if (!existingDataProduct) {
      await api.getDataProductDomain({ domainId });
    }

    // Optimistically lock the scripts
    const scriptEntityIdentifiers = dataProductToWrite.transforms.map((script) =>
      entityIdentifier('DataProductScript', script),
    );

    const uniqueScriptEntityIdentifiers = uniqWith(scriptEntityIdentifiers, isEqual);

    await lockClient.acquire(...uniqueScriptEntityIdentifiers);

    // Check each referenced script exists
    await Promise.all(
      dataProductToWrite.transforms.map((transform) => api.getDataProductScriptsNamespaceScript(transform)),
    );

    // Write the data product to the store
    const writtenDataProduct = await dataProductStore.putDataProduct(domainId, dataProductId, userId, {
      ...dataProductToWrite,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      dataStatus: DataProductDataStatus.NO_DATA,
      sourceDataStatus: isRawSourceSupported(dataProductToWrite)
        ? DataProductSourceDataStatus.UPDATING
        : DataProductSourceDataStatus.NO_DATA,
    });

    // Relate the data product to the domain
    const dataProductEntityIdentifier = entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId });
    await relationshipClient.addRelationships(callingUser, domainEntityIdentifier, [dataProductEntityIdentifier]);

    // Relate the data product to its transform scripts
    await relationshipClient.addRelationships(callingUser, dataProductEntityIdentifier, uniqueScriptEntityIdentifiers);

    // Relate the data product to the ontologies it references
    await relateDataProductWithOntologies(callingUser, api, writtenDataProduct, lockClient, relationshipClient);

    // Creating a data product policy will lock the data product, so we release our locks early
    await lockClient.releaseAll();

    // Add default policies to the data product
    await api.putGovernancePolicyDomainDataProduct({
      domainId,
      dataProductId,
      dataProductPolicyInput: {
        permissions: {
          [DefaultGroupIds.DEFAULT]: {
            access: DataProductAccess.READ_ONLY,
          },
          [DefaultGroupIds.POWER_USER]: {
            access: DataProductAccess.READ_ONLY,
          },
          ...Object.fromEntries(
            (initialFullAccessGroups || []).map((groupId) => [
              groupId,
              {
                access: DataProductAccess.FULL,
              },
            ]),
          ),
        },
      },
    });

    // We create the infrastructure for the data product only when the data product is first created
    await startDynamicInfrastructureCreation(callingUser, writtenDataProduct);

    // Kick off the final schema discovery and preparation of raw source tables
    await startBuildDataProductSchemaAndSource({
      dataProduct: writtenDataProduct,
      callingUser,
    });

    return ApiResponse.success(writtenDataProduct);
  },
);
