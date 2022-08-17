/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import { CallingUser } from '@ada/common';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../../components/ddb/saved-query';
import { SavedQuery, SavedQueryIdentifier } from '@ada/api-client';
import { buildApiRequest } from '@ada/api-gateway';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-saved-query';

jest.mock('@ada/api-client');

const testPublicSavedQueryStore = new (PublicSavedQueryStore as any)(getLocalDynamoDocumentClient());
PublicSavedQueryStore.getInstance = jest.fn(() => testPublicSavedQueryStore);
const testPrivateSavedQueryStore = new (PrivateSavedQueryStore as any)(getLocalDynamoDocumentClient());
PrivateSavedQueryStore.getInstance = jest.fn(() => testPrivateSavedQueryStore);

const DEFAULT_USER = 'test-user';

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

describe('get-saved-query', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const getSavedQuery = (
    namespace: string,
    queryId: string,
    callingUser: CallingUser = { userId: DEFAULT_USER, username: `${DEFAULT_USER}@usr.example.com`, groups: ['admin'] },
  ) =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { namespace, queryId },
      }) as any,
      null,
    );

  it('should return 404 when the namespaced domain does not exist', async () => {
    API.getDataProductDomain.mockRejectedValue(apiClientErrorResponse(404, { message: 'Not Found' }));
    expect((await getSavedQuery('wrong_domain', 'test')).statusCode).toBe(404);
  });

  it('should return 404 when the saved query does not exist', async () => {
    API.getDataProductDomain.mockResolvedValue({
      domainId: 'domain',
    });
    expect((await getSavedQuery('domain', 'test')).statusCode).toBe(404);
  });

  it('should return the saved query for a domain when it exists', async () => {
    API.getDataProductDomain.mockResolvedValue({
      domainId: 'domain',
    });
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
    const response = await getSavedQuery(PUBLIC_QUERY_ID.namespace, PUBLIC_QUERY_ID.queryId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(SAVED_PUBLIC_QUERY));
  });

  it('should return the saved private query when it exists', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    const response = await getSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(SAVED_PRIVATE_QUERY));
  });

  it('should return 404 when requesting a different users saved private query', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    const response = await getSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId, {
      userId: 'different-user',
      username: 'different-user@diff.example.com',
      groups: [],
    });
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toStrictEqual({
      message: 'Could not find the query test in namespace test-user',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });
});
