/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, Query } from '@ada/api';
import { GenericDynamodbStore } from '@ada/microservice-common';

// Table names are passed as environment variables defined in the CDK infrastructure
const { CACHED_QUERY_TABLE_NAME } = process.env;

export interface BaseCachedQuery {
  cacheId: string;
}

export interface CachedGeneratedQuery extends Query, BaseCachedQuery {
  queryExecutionId?: string;
  athenaStatus?: any;
}

export interface CachedDiscoveryQuery extends Query, BaseCachedQuery {
  discoverResponse: any;
}

export type CachedGeneratedQueryWithCreateAndUpdateDetails = CachedGeneratedQuery & CreateAndUpdateDetails;

export type CachedDiscoveryQueryWithCreateAndUpdateDetails = CachedDiscoveryQuery & CreateAndUpdateDetails;

export type CachedQueryTypes = CachedDiscoveryQuery | CachedGeneratedQuery;

type CachedQueryIdentifier = Pick<BaseCachedQuery, 'cacheId'>;

/**
 * Class for interacting with CachedQueries in dynamodb
 */
export class CachedQueryStore {
  // Singleton instance of the cached query store
  private static instance: CachedQueryStore | undefined;

  /**
   * Get an instance of the cached query store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): CachedQueryStore =>
    CachedQueryStore.instance || new CachedQueryStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<CachedQueryIdentifier, CachedQueryTypes>;

  /**
   * Create an instance of the cached query store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<CachedQueryIdentifier, CachedQueryTypes>(ddb, CACHED_QUERY_TABLE_NAME ?? '');
  }

  /**
   * Get a cached query if present
   * @param cacheId the id of the cached query
   */
  private getCachedQuery = (
    cacheId: string,
  ): Promise<
    CachedGeneratedQueryWithCreateAndUpdateDetails | CachedDiscoveryQueryWithCreateAndUpdateDetails | undefined
  > => {
    return this.store.get({ cacheId });
  };

  /**
   * Get a cached generated query if present
   * @param cacheId the id of the cached query
   */
  public getCachedGeneratedQuery = (
    cacheId: string,
  ): Promise<CachedGeneratedQueryWithCreateAndUpdateDetails | undefined> =>
    this.getCachedQuery(cacheId) as Promise<CachedGeneratedQueryWithCreateAndUpdateDetails | undefined>;

  /**
   * Get a cached discovery query if present
   * @param cacheId the id of the cached query
   */
  public getCachedDiscoveryQuery = (
    cacheId: string,
  ): Promise<CachedDiscoveryQueryWithCreateAndUpdateDetails | undefined> =>
    this.getCachedQuery(cacheId) as Promise<CachedDiscoveryQueryWithCreateAndUpdateDetails | undefined>;

  /**
   * Create or update a cached query
   * @param cacheId the id of the cached query to create/update
   * @param userId the id of the user performing the operation
   * @param cache the cached query to write
   */
  private putCachedQuery = (
    cacheId: string,
    userId: string,
    cachedQuery:
      | CachedGeneratedQuery
      | CachedDiscoveryQuery
      | CachedGeneratedQueryWithCreateAndUpdateDetails
      | CachedDiscoveryQueryWithCreateAndUpdateDetails,
  ): Promise<CachedGeneratedQueryWithCreateAndUpdateDetails | CachedDiscoveryQueryWithCreateAndUpdateDetails> => {
    return this.store.put({ cacheId }, userId, cachedQuery, false);
  };

  /**
   * Create or update a cached dscovery query
   * @param cacheId the id of the cached query to create/update
   * @param userId the id of the user performing the operation
   * @param cache the discovery query to cache
   */
  public putCachedDiscoveryQuery = (
    cacheId: string,
    userId: string,
    cachedQuery: CachedDiscoveryQuery,
  ): Promise<CachedDiscoveryQueryWithCreateAndUpdateDetails> =>
    this.putCachedQuery(cacheId, userId, cachedQuery) as Promise<CachedDiscoveryQueryWithCreateAndUpdateDetails>;

  /**
   * Create or update a cached generated query
   * @param cacheId the id of the cached query to create/update
   * @param userId the id of the user performing the operation
   * @param cache the generated query to cache
   */
  public putCachedGeneratedQuery = (
    cacheId: string,
    userId: string,
    cachedQuery: CachedGeneratedQuery | CachedGeneratedQueryWithCreateAndUpdateDetails,
  ): Promise<CachedGeneratedQueryWithCreateAndUpdateDetails> =>
    this.putCachedQuery(cacheId, userId, cachedQuery) as Promise<CachedGeneratedQueryWithCreateAndUpdateDetails>;
}
