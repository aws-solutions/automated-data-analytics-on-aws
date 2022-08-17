/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../components/ddb/saved-query';
import { entityIdentifier } from '@ada/api-client/types';
import { isPrivateNamespace, validateNamespace } from '../../components/saved-query';

/**
 * Handler for deleting a saved query
 */
export const handler = ApiLambdaHandler.for(
  'deleteQuerySavedQuery',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { namespace, queryId } = requestParameters;

    const isPrivate = isPrivateNamespace(callingUser, namespace);
    await validateNamespace(ApiClient.create(callingUser), callingUser, namespace);
    const queryStore = isPrivate ? PrivateSavedQueryStore.getInstance() : PublicSavedQueryStore.getInstance();

    const savedQueryIdentifier = { namespace, queryId };
    log.info(`savedQueryIdentifier: ${savedQueryIdentifier}`);

    const existingSavedQuery = await queryStore.getSavedQuery(savedQueryIdentifier);
    log.info(`existingSavedQuery: ${existingSavedQuery}`);

    if (!existingSavedQuery) {
      return ApiResponse.notFound({
        message: `No query found in namespace ${namespace} with id ${queryId}`,
      });
    }

    // Only the creator of the saved query or an admin may delete it
    if (existingSavedQuery.createdBy !== callingUser.userId && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to delete the query in namespace ${namespace} with id ${queryId}`,
      });
    }

    // Related saved queries will include BOTH queries that this query depends on (parents), and queries that depend on this (children)
    const savedQueryEntity = entityIdentifier('QuerySavedQuery', savedQueryIdentifier);
    log.info(`savedQueryEntity: ${savedQueryEntity}`);

    const relatedSavedQueries = await relationshipClient.getRelatedEntitiesOfType(savedQueryEntity, 'QuerySavedQuery');
    log.info(`relatedSavedQueries: ${relatedSavedQueries}`);

    // Get the saved queries that this query depends on (parents)
    const parentSavedQueryCompositeIds = new Set(
      existingSavedQuery.referencedQueries.map(({ namespace, queryId }) => `${namespace}.${queryId}`), //NOSONAR (typescript:S1117) - upper scope declaration
    );
    log.info(`parentSavedQueryCompositeIds: ${parentSavedQueryCompositeIds}`);

    // Children and parents are mutually exclusive since saved queries cannot have circular references, therefore child
    // queries are any related queries that are not parents.
    const childSavedQueries = relatedSavedQueries.filter(
      ({ namespace, queryId }) => !parentSavedQueryCompositeIds.has(`${namespace}.${queryId}`), //NOSONAR (typescript:S1117) - upper scope declaration
    );
    log.info(`childSavedQueries: ${childSavedQueries}`);

    // NOTE: We can consider filtering out private saved queries here in the future if it's too much friction to block deletion
    // and it's considered acceptable to break dependency chains for private queries

    if (childSavedQueries.length > 0) {
      return ApiResponse.badRequest({
        message: `This saved query cannot be deleted since it is referenced by the following saved queries: ${childSavedQueries
          .map(({ namespace, queryId }) => `${namespace}.${queryId}`) //NOSONAR (typescript:S1117) - upper scope declaration
          .join(', ')}`,
      });
    }

    // Delete the saved query and its relationships
    await Promise.all<any>([
      queryStore.deleteSavedQueryIfExists(savedQueryIdentifier),
      relationshipClient.removeAllRelationships(savedQueryEntity),
    ]);

    return ApiResponse.success(existingSavedQuery);
  },
);
