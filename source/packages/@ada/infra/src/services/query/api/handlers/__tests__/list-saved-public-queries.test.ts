/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { CallingUser } from '@ada/common';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../../components/ddb/saved-query';
import { SavedQuery, SavedQueryIdentifier } from '@ada/api-client';
import { buildApiRequest } from '@ada/api-gateway';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-saved-public-queries';

jest.mock('@ada/api-client');

const testPublicSavedQueryStore = new (PublicSavedQueryStore as any)(getLocalDynamoDocumentClient());
PublicSavedQueryStore.getInstance = jest.fn(() => testPublicSavedQueryStore);
const testPrivateSavedQueryStore = new (PrivateSavedQueryStore as any)(getLocalDynamoDocumentClient());
PrivateSavedQueryStore.getInstance = jest.fn(() => testPrivateSavedQueryStore);

const DEFAULT_USER = 'test-user';
const ANOTHER_USER = 'another-user';

const PRIVATE_QUERY_ID = {
  namespace: DEFAULT_USER,
  queryId: 'test',
};
const DIFFERENT_PRIVATE_QUERY_ID = {
  namespace: ANOTHER_USER,
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

describe('list-saved-public-queries', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    await testPrivateSavedQueryStore.putSavedQuery(DIFFERENT_PRIVATE_QUERY_ID, ANOTHER_USER, {
      ...SAVED_PRIVATE_QUERY,
      ...DIFFERENT_PRIVATE_QUERY_ID,
    });
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const listSavedPublicQueries = (
    callingUser: CallingUser = { userId: DEFAULT_USER, username: `${DEFAULT_USER}@usr.example.com`, groups: ['admin'] },
  ) => handler(buildApiRequest(callingUser, {}) as any, null);

  it('should return all public queries', async () => {
    const response = await listSavedPublicQueries();
    expect(response.statusCode).toBe(200);
    const results = JSON.parse(response.body).queries;
    // Only one query returned, the public one
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining(SAVED_PUBLIC_QUERY));
  });

  it('should return bad requests for errors', async () => {
    testPublicSavedQueryStore.listAllSavedQueries = jest.fn().mockReturnValue({ error: 'bad query' });
    const response = await listSavedPublicQueries();
    expect(testPublicSavedQueryStore.listAllSavedQueries).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({ name: 'Error', message: 'bad query', errorId: expect.stringMatching(/\w{10}/) });
  });
});
