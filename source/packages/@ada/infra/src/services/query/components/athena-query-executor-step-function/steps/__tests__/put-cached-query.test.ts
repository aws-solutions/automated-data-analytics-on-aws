/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { CachedGeneratedQuery, CachedQueryStore } from '../../../ddb/cached-query';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { computeUniqueHash } from '@ada/common';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../put-cached-query';

describe('put-cached-query', () => {
  const before = '2020-01-01T00:00:00.000Z';
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
  const putCachedQueryHandler = (query: CachedGeneratedQuery): Promise<CachedGeneratedQuery> =>
    handler(
      {
        Payload: {
          ...query,
        },
      },
      null,
    );

  it('should write the cached item in the database', async () => {
    const query = 'select * from foo';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    const output = await putCachedQueryHandler(cache);
    expect(output).toStrictEqual(
      expect.objectContaining({
        ...cache,
      }),
    );

    const result = await testCachedStore.getCachedGeneratedQuery(cacheId);

    expect(result).toStrictEqual({
      cacheId: cacheId,
      queryExecutionId: 'any-exec-id',
      athenaStatus: 'any',
      query,
      createdBy: 'system',
      createdTimestamp: now,
      updatedBy: 'system',
      updatedTimestamp: now,
    });
  });

  it('should update the cached item in the database', async () => {
    const query = 'select * from foo';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    const output = await putCachedQueryHandler(cache);
    expect(output).toStrictEqual(
      expect.objectContaining({
        ...cache,
      }),
    );

    const result = await testCachedStore.getCachedGeneratedQuery(cacheId);

    expect(result).toStrictEqual({
      cacheId: cacheId,
      queryExecutionId: 'any-exec-id',
      athenaStatus: 'any',
      query,
      createdBy: 'system',
      createdTimestamp: now,
      updatedBy: 'system',
      updatedTimestamp: now,
    });

    const updateCache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
      updatedTimestamp: now,
    } as CachedGeneratedQuery;
    const updatedOutput = await putCachedQueryHandler(updateCache);
    expect(updatedOutput).toStrictEqual(
      expect.objectContaining({
        ...updateCache,
      }),
    );
  });

  it('should NOT update the cached item in the database if the updatedTimestamp does not exist', async () => {
    const query = 'select * from foo';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    const output = await putCachedQueryHandler(cache);
    expect(output).toStrictEqual(
      expect.objectContaining({
        ...cache,
      }),
    );

    const result = await testCachedStore.getCachedGeneratedQuery(cacheId);

    expect(result).toStrictEqual({
      cacheId: cacheId,
      queryExecutionId: 'any-exec-id',
      athenaStatus: 'any',
      query,
      createdBy: 'system',
      createdTimestamp: now,
      updatedBy: 'system',
      updatedTimestamp: now,
    });

    const updateCache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;
    await expect(putCachedQueryHandler(updateCache)).rejects.toThrowError('Item with same id already exists.');
  });

  it('should NOT update the cached item in the database if the updatedTimestamp does not match', async () => {
    const query = 'select * from foo';
    const cacheId = computeUniqueHash(query);
    const cache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
    } as CachedGeneratedQuery;

    const output = await putCachedQueryHandler(cache);
    expect(output).toStrictEqual(
      expect.objectContaining({
        ...cache,
      }),
    );

    const result = await testCachedStore.getCachedGeneratedQuery(cacheId);

    expect(result).toStrictEqual({
      cacheId: cacheId,
      queryExecutionId: 'any-exec-id',
      athenaStatus: 'any',
      query,
      createdBy: 'system',
      createdTimestamp: now,
      updatedBy: 'system',
      updatedTimestamp: now,
    });

    const updateCache = {
      cacheId,
      query,
      athenaStatus: 'any',
      queryExecutionId: 'any-exec-id',
      updatedTimestamp: before,
    } as CachedGeneratedQuery;
    await expect(putCachedQueryHandler(updateCache)).rejects.toThrowError();
  });
});
