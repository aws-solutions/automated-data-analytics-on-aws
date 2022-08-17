/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../../components/ddb/saved-query';
import { SavedQuery, SavedQueryIdentifier } from '@ada/api-client';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { handler } from '../delete-saved-query';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client');

const testPublicSavedQueryStore = new (PublicSavedQueryStore as any)(getLocalDynamoDocumentClient());
PublicSavedQueryStore.getInstance = jest.fn(() => testPublicSavedQueryStore);
const testPrivateSavedQueryStore = new (PrivateSavedQueryStore as any)(getLocalDynamoDocumentClient());
PrivateSavedQueryStore.getInstance = jest.fn(() => testPrivateSavedQueryStore);

const DEFAULT_USER = DEFAULT_CALLER.userId;

const PRIVATE_QUERY_ID = {
  namespace: DEFAULT_USER,
  queryId: 'test',
};
const SAVED_PRIVATE_QUERY: SavedQuery = {
  ...PRIVATE_QUERY_ID,
  addressedAs: 'my.queries.test',
  type: 'PRIVATE',
  query: 'select * from foo',
  referencedDataSets: [],
  referencedQueries: [],
};

const PUBLIC_QUERY_ID: SavedQueryIdentifier = {
  namespace: 'domain',
  queryId: 'test',
};
const SAVED_PUBLIC_QUERY: SavedQuery = {
  ...PUBLIC_QUERY_ID,
  addressedAs: 'domain.queries.test',
  type: 'PUBLIC',
  query: 'select * from foo',
  referencedDataSets: [],
  referencedQueries: [],
};

describe('delete-saved-query', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();

    relationshipClient = localDynamoRelationshipClient();
    localDynamoLockClient();
  });

  const deleteSavedQuery = (namespace: string, queryId: string, callingUser: CallingUser = DEFAULT_CALLER) =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { namespace, queryId },
      }) as any,
      null,
    );

  it('should return 404 when the saved query is in a namespace that does not exist', async () => {
    API.getDataProductDomain.mockRejectedValue(apiClientErrorResponse(404, { message: 'Not Found' }));
    expect((await deleteSavedQuery('doesnotexist', 'test')).statusCode).toBe(404);
  });

  it('should return 404 when the saved query does not exist', async () => {
    API.getDataProductDomain.mockResolvedValue({});
    expect((await deleteSavedQuery('exists', 'doesnotexist')).statusCode).toBe(404);
  });

  it('should delete a public saved query', async () => {
    API.getDataProductDomain.mockResolvedValue({});
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
    const response = await deleteSavedQuery(PUBLIC_QUERY_ID.namespace, PUBLIC_QUERY_ID.queryId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(SAVED_PUBLIC_QUERY));
    expect(await testPublicSavedQueryStore.getSavedQuery(PUBLIC_QUERY_ID)).toBeUndefined();
  });

  it('should return 403 if the calling user is not the one who created the query', async () => {
    API.getDataProductDomain.mockResolvedValue({});
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
    const response = await deleteSavedQuery(PUBLIC_QUERY_ID.namespace, PUBLIC_QUERY_ID.queryId, {
      userId: 'different-user',
      groups: [DefaultGroupIds.DEFAULT],
      username: 'any',
    });
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body);
    expect(body.message).toContain("You don't have permissions to delete the query in namespace");
    expect(body.message).toContain(PUBLIC_QUERY_ID.namespace);
    expect(body.message).toContain(PUBLIC_QUERY_ID.queryId);
    expect(await testPublicSavedQueryStore.getSavedQuery(PUBLIC_QUERY_ID)).toBeDefined();
  });

  it('should delete a public saved query if the user is not the same but belongs to admin group', async () => {
    API.getDataProductDomain.mockResolvedValue({});
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
    const response = await deleteSavedQuery(PUBLIC_QUERY_ID.namespace, PUBLIC_QUERY_ID.queryId, {
      userId: 'different-user',
      groups: [DefaultGroupIds.DEFAULT, DefaultGroupIds.ADMIN],
      username: 'any',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(SAVED_PUBLIC_QUERY));
    expect(await testPublicSavedQueryStore.getSavedQuery(PUBLIC_QUERY_ID)).toBeUndefined();
  });

  it('should delete a private saved query', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    const response = await deleteSavedQuery(PRIVATE_QUERY_ID.namespace, PRIVATE_QUERY_ID.queryId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(SAVED_PRIVATE_QUERY));
    expect(await testPrivateSavedQueryStore.getSavedQuery(PRIVATE_QUERY_ID)).toBeUndefined();
  });

  /// private query are namespaced by the user's id so different user can't interact with other user's query
  it('should NOT delete a private saved query if the user is not the one who created it', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    const response = await deleteSavedQuery(PRIVATE_QUERY_ID.namespace, PRIVATE_QUERY_ID.queryId, {
      userId: 'different-user',
      groups: [DefaultGroupIds.DEFAULT],
      username: 'any',
    });
    expect(response.statusCode).toBe(404);
    expect(await testPrivateSavedQueryStore.getSavedQuery(PRIVATE_QUERY_ID)).toBeDefined();
  });

  it('should NOT delete a private saved query if the user is not the one who created it (even if admin)', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    const response = await deleteSavedQuery(PRIVATE_QUERY_ID.namespace, PRIVATE_QUERY_ID.queryId, {
      userId: 'different-user',
      groups: [DefaultGroupIds.DEFAULT, DefaultGroupIds.ADMIN],
      username: 'any',
    });
    expect(response.statusCode).toBe(404);
    expect(await testPrivateSavedQueryStore.getSavedQuery(PRIVATE_QUERY_ID)).toBeDefined();
  });

  it('should delete a query that references other queries but is not referenced by others', async () => {
    const referencedQueries = [
      { namespace: 'parent', queryId: 'one' },
      { namespace: 'parent', queryId: 'two' },
    ];
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, {
      ...SAVED_PRIVATE_QUERY,
      referencedQueries,
    });
    const queryEntity = entityIdentifier('QuerySavedQuery', PRIVATE_QUERY_ID);
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      queryEntity,
      referencedQueries.map((q) => entityIdentifier('QuerySavedQuery', q)),
    );

    expect((await deleteSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId)).statusCode).toBe(200);
    expect(await relationshipClient.getRelatedEntities(queryEntity)).toHaveLength(0);
  });

  it('should not allow deletion of a query that is referenced by other queries', async () => {
    const referencedQueries = [
      { namespace: 'parent', queryId: 'one' },
      { namespace: 'parent', queryId: 'two' },
    ];
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, {
      ...SAVED_PRIVATE_QUERY,
      referencedQueries,
    });
    await relationshipClient.addRelationships(DEFAULT_CALLER, entityIdentifier('QuerySavedQuery', PRIVATE_QUERY_ID), [
      // Relate to the referenced queries
      ...referencedQueries.map((q) => entityIdentifier('QuerySavedQuery', q)),
      // Also relate to a child query (ie a query that depends on this)
      entityIdentifier('QuerySavedQuery', { namespace: 'child', queryId: 'one' }),
    ]);

    const response = await deleteSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId);
    expect(response.statusCode).toBe(400);
    const message = JSON.parse(response.body).message;
    expect(message).toContain('child.one');
    expect(message).not.toContain('parent.one');
    expect(message).not.toContain('parent.two');
  });
});
