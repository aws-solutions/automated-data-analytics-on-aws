/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';
import { SavedQuery, SavedQueryEntity, SavedQueryIdentifier, SavedQueryList } from '@ada/api';

// Table names are passed as environment variables defined in the CDK infrastructure
const { SAVED_PUBLIC_QUERY_TABLE_NAME, SAVED_PRIVATE_QUERY_TABLE_NAME } = process.env;

/**
 * Saved query store for interacting with either public or private queries
 */
export class SavedQueryStore {
  private readonly store: GenericDynamodbStore<SavedQueryIdentifier, SavedQuery>;

  /**
   * Create an instance of the saved query store
   * @param ddb dynamodb document client
   * @param tableName the saved query store table name
   */
  public constructor(ddb: DynamoDB.DocumentClient, tableName: string) {
    this.store = new GenericDynamodbStore<SavedQueryIdentifier, SavedQuery>(ddb, tableName);
  }

  /**
   * Get a saved query if present
   * @param savedQueryIdentifier the id of the saved query
   */
  public getSavedQuery = (savedQueryIdentifier: SavedQueryIdentifier): Promise<SavedQueryEntity | undefined> => {
    return this.store.get(savedQueryIdentifier);
  };

  /**
   * Create or update a saved query
   * @param savedQueryIdentifier the id of the saved query to create/update
   * @param userId the id of the user performing the operation
   * @param savedQuery the saved query to write
   */
  public putSavedQuery = (
    savedQueryIdentifier: SavedQueryIdentifier,
    userId: string,
    savedQuery: SavedQuery,
  ): Promise<SavedQueryEntity> => {
    return this.store.put(savedQueryIdentifier, userId, savedQuery);
  };

  /**
   * Delete a saved query if it exists
   * @param savedQueryIdentifier the id of the saved query to delete
   */
  public deleteSavedQueryIfExists = (
    savedQueryIdentifier: SavedQueryIdentifier,
  ): Promise<SavedQueryEntity | undefined> => this.store.deleteIfExists(savedQueryIdentifier);

  /**
   * Lists the saved queries within a namespace
   * @param namespace the public query namespace (eg userId) to list queries for
   * @param paginationParameters options for pagination
   */
  public listSavedQueriesWithinNamespace = async (
    namespace: string,
    paginationParameters: PaginationParameters,
  ): Promise<SavedQueryList & { error?: string }> => {
    const result = await this.store.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('namespace', namespace),
    );
    return { queries: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };

  /**
   * Lists all saved queries
   * @param paginationParameters options for pagination
   */
  public listAllSavedQueries = async (
    paginationParameters: PaginationParameters,
  ): Promise<SavedQueryList & { error?: string }> => {
    const result = await this.store.list(paginationParameters);
    return { queries: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };
}

/**
 * Class for interacting with public saved queries in dynamodb
 */
export class PublicSavedQueryStore extends SavedQueryStore {
  // Singleton instance of the saved query store
  private static instance: PublicSavedQueryStore | undefined;

  /**
   * Get an instance of the public saved query store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): PublicSavedQueryStore => {
    if (!PublicSavedQueryStore.instance) {
      PublicSavedQueryStore.instance = new PublicSavedQueryStore(AwsDynamoDBDocumentClient());
    }
    return PublicSavedQueryStore.instance;
  };

  /**
   * Create an instance of the saved query store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    super(ddb, SAVED_PUBLIC_QUERY_TABLE_NAME ?? '');
  }
}

/**
 * Class for interacting with private saved queries in dynamodb
 */
export class PrivateSavedQueryStore extends SavedQueryStore {
  // Singleton instance of the saved query store
  private static instance: PrivateSavedQueryStore | undefined;

  /**
   * Get an instance of the private saved query store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): PrivateSavedQueryStore => {
    if (!PrivateSavedQueryStore.instance) {
      PrivateSavedQueryStore.instance = new PrivateSavedQueryStore(AwsDynamoDBDocumentClient());
    }
    return PrivateSavedQueryStore.instance;
  };

  /**
   * Create an instance of the saved query store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    super(ddb, SAVED_PRIVATE_QUERY_TABLE_NAME ?? '');
  }
}
