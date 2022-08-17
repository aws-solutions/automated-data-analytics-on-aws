/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, PaginatedResponse, QueryHistory } from '@ada/api';
import { PaginationParameters } from '@ada/api-gateway';
import {
  fetchPageWithQueryForHashKeyEquals,
  getCreateAndUpdateDetails,
  listWithPaginationParameters,
} from '@ada/microservice-common';

const QUERY_HISTORY_TABLE_NAME = process.env.QUERY_HISTORY_TABLE_NAME ?? '';

export type QueryHistoryWithCreateAndUpdateDetails = QueryHistory & CreateAndUpdateDetails;

/**
 * The structure of a response when listing queries
 */
export interface ListQueryHistoryResponse extends PaginatedResponse {
  readonly queries: QueryHistory[];
  readonly error?: string;
}

/**
 * Class for interacting with Query History in dynamodb
 */
export class QueryHistoryStore {
  // Singleton instance of the query history store
  private static instance: QueryHistoryStore | undefined;
  private readonly ddb: DynamoDB.DocumentClient;
  private readonly tableName: string = QUERY_HISTORY_TABLE_NAME;

  /**
   * Get an instance of the query history store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): QueryHistoryStore =>
    QueryHistoryStore.instance || new QueryHistoryStore(AwsDynamoDBDocumentClient());

  /**
   * Create an instance of the query history store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
  }

  /**
   * Create a new query history object
   * @param query the query history details
   * @param userId the user Id that performed the action
   * @returns the element written in the database
   */
  public putQueryHistory = async (query: QueryHistory, userId: string) => {
    // always create a new item thus no need to read the previous one
    const createAndUpdateDetails = getCreateAndUpdateDetails(userId, undefined);

    return this.ddb
      .put({
        TableName: this.tableName,
        Item: {
          ...query,
          ...createAndUpdateDetails,
        },
      })
      .promise();
  };

  public getUserQueryHistory = async (
    userId: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListQueryHistoryResponse> => {
    const result = await listWithPaginationParameters<QueryHistoryWithCreateAndUpdateDetails>(
      this.ddb,
      this.tableName,
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('createdBy', userId, {
        // true = ascending, false = descending
        scanIndexForward: false,
      }),
    );

    return {
      queries: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };
}
