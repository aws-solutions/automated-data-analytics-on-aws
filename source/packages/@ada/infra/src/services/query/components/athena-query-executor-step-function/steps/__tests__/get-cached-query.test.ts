/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { CachedGeneratedQuery, CachedQueryStore } from '../../../ddb/cached-query';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProduct, DataSets, PostQueryParseRenderDiscoverResponse } from '@ada/api';
import { DataProductAccess, DataSetIds, ReservedDataProducts, ReservedDomains, computeUniqueHash } from '@ada/common';
import { DataProductPermissions } from '@ada/microservice-common';
import { GetCachedQueryResult, handler } from '../get-cached-query';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const queryDiscoverResponse: PostQueryParseRenderDiscoverResponse = {
  tables: [{ identifierParts: ['default', 'test'] }],
};

const getDataProductPolicy: DataProductPermissions = {
  admin: {
    access: DataProductAccess.FULL,
  },
};

const dataSets: DataSets = {
  [DataSetIds.DEFAULT]: {
    columnMetadata: {},
    identifiers: {},
  },
};

const getDataProductResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets,
};

const updatedDataProduct: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  latestDataUpdateTimestamp: '2021-10-10T00:00:00.000Z',
  dataSets,
};

jest.mock('@ada/api-client-lambda');

describe('get-cached-query', () => {
  const now = '2021-01-01T00:00:00.000Z';

  let testCachedStore: CachedQueryStore;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    // Mock the dataProduct store to point to our local dynamodb
    testCachedStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
    CachedQueryStore.getInstance = jest.fn(() => testCachedStore);

    jest.clearAllMocks();
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  })

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // Helper method for calling the handler
  const getCachedQueryHandler = (query: string, originalQuery: string): Promise<GetCachedQueryResult> =>
    handler(
      {
        Payload: {
          query,
          originalQuery,
          callingUser: {
            groups: ['admin'],
            userId: 'test-user',
            username: 'test-user@usr.example.com',
          },
        },
      },
      null,
    );

  it('should return the cached data if the query is in the cache', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue(getDataProductPolicy);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
    const query = 'select * from foo';
    const originalQuery = 'select * from domain.dp';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    await testCachedStore.putCachedGeneratedQuery(cacheId, 'test-user', cache);

    const response = await getCachedQueryHandler(query, originalQuery);

    expect(response).toStrictEqual(
      expect.objectContaining({
        expired: false,
        cacheId: cacheId,
        queryExecutionId: 'any-exec-id',
        athenaStatus: 'any',
        query,
        originalQuery,
        callingUser: {
          username: 'test-user@usr.example.com',
          groups: ['admin'],
          userId: 'test-user',
        },
      }),
    );
  });

  it('should return expired flag at true if the cache is empty', async () => {
    const query = 'select * from foo';
    const originalQuery = 'select * from domain.dp';
    const response = await getCachedQueryHandler(query, originalQuery);

    expect(response).toStrictEqual({
      expired: true,
      query,
      cacheId: computeUniqueHash(query),
      originalQuery,
      callingUser: {
        groups: ['admin'],
        username: 'test-user@usr.example.com',
        userId: 'test-user',
      },
    });
  });

  it('should return expired flag at true if the data product has been updated after the cache was created', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue(getDataProductPolicy);
    API.getDataProductDomainDataProduct.mockResolvedValue(updatedDataProduct);
    const query = 'select * from foo';
    const originalQuery = 'select * from domain.dp';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    await testCachedStore.putCachedGeneratedQuery(cacheId, 'test-user', cache);

    const response = await getCachedQueryHandler(query, originalQuery);

    expect(response).toStrictEqual(
      expect.objectContaining({
        expired: true,
        query,
        cacheId: computeUniqueHash(query),
        originalQuery,
        callingUser: {
          groups: ['admin'],
          username: 'test-user@usr.example.com',
          userId: 'test-user',
        },
      }),
    );
  });

  it('should return expired flag at true if a data product referenced by a query has been updated after the cache was created', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.MY, ReservedDataProducts.QUERIES, 'test'] }],
    });
    API.getQuerySavedQuery.mockResolvedValue({
      referencedDataSets: [
        {
          domainId: 'default',
          dataProductId: 'test',
          dataSetId: DataSetIds.DEFAULT,
          addressedAs: 'default.test',
        },
      ],
      referencedQueries: [],
    });
    API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue(getDataProductPolicy);
    API.getDataProductDomainDataProduct.mockResolvedValue(updatedDataProduct);
    const query = 'select * from foo';
    const originalQuery = 'select * from my.queries.test';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    await testCachedStore.putCachedGeneratedQuery(cacheId, 'test-user', cache);

    const response = await getCachedQueryHandler(query, originalQuery);

    expect(response).toStrictEqual(
      expect.objectContaining({
        expired: true,
        query,
        cacheId: computeUniqueHash(query),
        originalQuery,
        callingUser: {
          groups: ['admin'],
          username: 'test-user@usr.example.com',
          userId: 'test-user',
        },
      }),
    );
  });
});
