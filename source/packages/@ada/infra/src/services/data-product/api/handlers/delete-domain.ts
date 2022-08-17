/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { DomainStore } from '../../components/ddb/domain';
import { entityIdentifier } from '@ada/api-client/types';
import { filterRelatedEntitiesOfType } from '../../../api/components/entity/relationships/client';

/**
 * Handler for deleting a domain
 */
export const handler = ApiLambdaHandler.for(
  'deleteDataProductDomain',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { domainId } = requestParameters;

    const store = DomainStore.getInstance();
    const domain = await store.getDomain(domainId);

    if (!domain) {
      return ApiResponse.notFound({
        message: `No domain found with id ${domainId}`,
      });
    }

    if (domain.createdBy !== callingUser.userId && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to delete the domain with id ${domainId}`,
      });
    }

    const domainEntity = entityIdentifier('DataProductDomain', { domainId });
    const relatedEntities = await relationshipClient.getRelatedEntities(domainEntity);

    // Only allow deleting domains without data products
    const relatedDataProducts = filterRelatedEntitiesOfType(relatedEntities, 'DataProductDomainDataProduct');
    if (relatedDataProducts.length > 0) {
      return ApiResponse.badRequest({
        message: `Cannot delete domain ${domainId} since it contains data products: ${relatedDataProducts
          .map(({ dataProductId }) => dataProductId)
          .join(', ')}`,
      });
    }

    // Only allow deleting domains without saved queries - these can be referenced cross-domain so it's not safe to
    // include deleting these as part of deleting a domain.
    const relatedSavedQueries = filterRelatedEntitiesOfType(relatedEntities, 'QuerySavedQuery');
    if (relatedSavedQueries.length > 0) {
      return ApiResponse.badRequest({
        message: `Cannot delete domain ${domainId} since it contains saved queries: ${relatedSavedQueries
          .map(({ queryId }) => queryId)
          .join(', ')}`,
      });
    }

    // Delete the domain and all scripts saved within the domain
    const relatedScripts = filterRelatedEntitiesOfType(relatedEntities, 'DataProductScript');
    const api = ApiClient.create(callingUser);
    await Promise.all<any>([
      ...relatedScripts.map((scriptId) => api.deleteDataProductScriptsNamespaceScript(scriptId)),
      store.deleteDomainIfExists(domainId),
      relationshipClient.removeAllRelationships(domainEntity),
    ]);
    log.info(`Deleted domain with id ${domainEntity}`);
    return ApiResponse.success(domain);
  },
);
