/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { EntityIdentifier, entityIdentifier } from '@ada/api-client/types';
import { LockedEntity } from '../../../api/components/entity/locks/client';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../components/ddb/saved-query';
import { ReservedDataProducts, ReservedDomains } from '@ada/common';
import { getReferencedQueriesAndDataSets } from '../../components/generate-query';
import { isPrivateNamespace, validateNamespace } from '../../components/saved-query';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

/**
 * Handler for saving a query
 */
export const handler = ApiLambdaHandler.for(
  'putQuerySavedQuery',
  async ({ requestParameters, body: savedQueryInput }, callingUser, _event, { lockClient, relationshipClient }) => {
    const { namespace, queryId } = requestParameters;
    const { userId } = callingUser;

    const isPrivate = isPrivateNamespace(callingUser, namespace);
    const domainEntityIdentifier: EntityIdentifier | undefined = isPrivate
      ? undefined
      : entityIdentifier('DataProductDomain', { domainId: namespace });

    // Acquire a lock on the domain to relate the query to
    const locks: LockedEntity[] = [];
    if (domainEntityIdentifier) {
      locks.push(...(await lockClient.acquire(domainEntityIdentifier)));
    }

    const api = ApiClient.create(callingUser);
    await validateNamespace(api, callingUser, namespace);
    const queryStore = isPrivate ? PrivateSavedQueryStore.getInstance() : PublicSavedQueryStore.getInstance();

    const savedQueryIdentifier = { namespace, queryId };

    const existingSavedQuery = await queryStore.getSavedQuery(savedQueryIdentifier);

    if (existingSavedQuery) {
      return ApiResponse.badRequest({
        message: `Saved queries cannot be modified since they may be depended on by other queries. Try deleting the saved query and recreating it instead.`,
      });
    }

    const { query } = savedQueryInput;
    const { dataSets, queries, dataProductIdentifiers } = await getReferencedQueriesAndDataSets(
      api,
      query,
      callingUser,
    );

    const referencedQueryIdentifiers = uniqWith(
      queries.map(({ namespace, queryId }) => ({ namespace, queryId })), //NOSONAR (S1117) - upper scope declaration
      isEqual,
    );
    // Acquire locks on the referenced data products and saved queries
    locks.push(
      ...(await lockClient.acquire(
        ...dataProductIdentifiers.map((dataProductIdentifier) =>
          entityIdentifier('DataProductDomainDataProduct', dataProductIdentifier),
        ),
      )),
      ...(await lockClient.acquire(
        ...referencedQueryIdentifiers.map((queryIdentifier) => entityIdentifier('QuerySavedQuery', queryIdentifier)),
      )),
    );

    if (!isPrivate) {
      // Validate that no private queries are referenced by a public query, otherwise only the creator can execute it!
      const privateReferencedQueries = queries.filter((referencedQuery) => referencedQuery.type === 'PRIVATE');
      if (privateReferencedQueries.length > 0) {
        return ApiResponse.badRequest({
          message: 'Cannot reference private queries in a public query',
          details: `The following private queries were referenced: ${privateReferencedQueries
            .map((referencedQuery) => referencedQuery.addressedAs)
            .join(', ')}`,
        });
      }
    }

    const writtenSavedQuery = await queryStore.putSavedQuery(savedQueryIdentifier, userId, {
      ...savedQueryIdentifier,
      ...savedQueryInput,
      addressedAs: `${isPrivate ? ReservedDomains.MY : namespace}.${ReservedDataProducts.QUERIES}.${queryId}`,
      referencedDataSets: uniqWith(
        dataSets.map(({ domainId, dataProductId, dataSetId, addressedAs }) => ({
          domainId,
          dataProductId,
          dataSetId,
          addressedAs,
        })),
        isEqual,
      ),
      referencedQueries: referencedQueryIdentifiers,
      type: isPrivate ? 'PRIVATE' : 'PUBLIC',
    });

    // Relate the query to the domain (if any), and the saved queries and data products it references
    await relationshipClient.addRelationships(
      callingUser,
      entityIdentifier('QuerySavedQuery', savedQueryIdentifier),
      locks.map(({ entity }) => entity),
    );

    await lockClient.release(...locks);

    return ApiResponse.success(writtenSavedQuery);
  },
);
