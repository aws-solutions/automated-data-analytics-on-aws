/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DefaultUser } from '@ada/common';
import { DynamoDB } from '@ada/aws-sdk';
import { PaginationParameters, fromToken, toToken } from '../../../services/api/api-gateway/api-request';
import { chunk, isEqual, uniqWith, zip } from 'lodash';
import TransactWriteItem = DynamoDB.DocumentClient.TransactWriteItem;
import { CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import { Logger } from '../../../common/constructs/lambda/lambda-logger';
import { VError } from 'verror';
import { paginatedRequest } from '../../../common/services/utils';

// The maximum number of items that can be retrieved in a BatchGetItem call
export const DYNAMODB_MAX_BATCH_GET_ITEMS = 100;

// The maximum number of items that can be written in a transaction
export const DYNAMODB_MAX_TRANSACTION_ITEMS = 25;

// The default number of items to return per page in a paginated request
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Return the create and update details to write for the given item
 * @param userId the user creating/updating the item
 * @param existingItem the item being updated (or undefined if being created)
 */
export const getCreateAndUpdateDetails = (
  userId: string,
  existingItem: CreateAndUpdateDetails | undefined,
): CreateAndUpdateDetails => {
  const now = new Date().toISOString();
  return {
    createdBy: existingItem ? existingItem.createdBy : userId,
    updatedBy: userId,
    createdTimestamp: existingItem ? existingItem.createdTimestamp : now,
    updatedTimestamp: now,
  };
};

/**
 * Structure containing information to allow us to keep track of paginated requests
 */
interface PaginationToken {
  lastEvaluatedKey: DynamoDB.DocumentClient.Key;
  remaining?: number;
}

/**
 * Structure containing information to allow us to keep track of pagination totals
 */
interface PaginationTotals {
  tableName: string;
  count: number;
}

/**
 * Represents a page of results when listing items in dynamodb. If error is defined, there was a problem fetching this
 * page of results
 */
export interface PaginatedItemsResponse<T> extends PaginatedResponse {
  items: T[];
  error?: string;
}

export interface FetchPageProps {
  readonly ddb: DynamoDB.DocumentClient;
  readonly tableName: string;
  readonly limit: number;
  readonly exclusiveStartKey?: DynamoDB.DocumentClient.Key;
}

export type PageFetcher = (
  props: FetchPageProps,
) => Promise<{ Items?: any[]; LastEvaluatedKey?: DynamoDB.DocumentClient.Key }>;

interface DynamoQueryCommonProps {
  readonly expressionAttributeValues?: DynamoDB.DocumentClient.ExpressionAttributeValueMap;
  readonly expressionAttributeNames?: DynamoDB.DocumentClient.ExpressionAttributeNameMap;
}

export interface FetchPageWithScanProps extends DynamoQueryCommonProps {
  readonly filterExpression?: string;
}

/**
 * For use in listWithPaginationParameters, fetches a page using a dynamodb scan
 * @param props props to pass to the scan
 * @param ddb document client
 * @param tableName name of the table to scan
 * @param limit number of items to fetch
 * @param exclusiveStartKey to continue where we left off
 */
export const fetchPageWithScan =
  (props?: FetchPageWithScanProps): PageFetcher =>
  async ({ ddb, tableName, limit, exclusiveStartKey }: FetchPageProps) =>
    ddb
      .scan({
        TableName: tableName,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ExpressionAttributeNames: props?.expressionAttributeNames,
        ExpressionAttributeValues: props?.expressionAttributeValues,
        FilterExpression: props?.filterExpression,
      })
      .promise();

export interface FetchPageWithQueryExtraProps {
  readonly indexName?: string;
  readonly scanIndexForward?: boolean;
}

export interface FetchPageWithQueryProps extends FetchPageWithQueryExtraProps, DynamoQueryCommonProps {
  readonly keyConditionExpression: string;
}

/**
 * Get total items for a table
 * @param tableName the table name to get the counter for
 */
export const getTotals = async (
  ddb: DynamoDB.DocumentClient,
  tableName: string,
): Promise<PaginationTotals | undefined> => {
  const totals = await ddb
    .get({
      TableName: process.env.COUNTER_TABLE_NAME!,
      Key: { tableName },
    })
    .promise();

  return totals.Item as PaginationTotals | undefined;
};

/**
 * For use in listWithPaginationParameters, fetches a page using a dynamodb query
 * @param keyConditionExpression condition for the query
 * @param expressionAttributeValues attribute values used in the query
 * @param expressionAttributeNames attribute names used in the query
 * @param indexName specify if querying a GSI
 * @param scanIndexForward order the results in ascending if true (default), or descending if false
 */
export const fetchPageWithQuery =
  ({
    keyConditionExpression,
    expressionAttributeValues,
    expressionAttributeNames,
    indexName,
    scanIndexForward,
  }: FetchPageWithQueryProps): PageFetcher =>
  async ({ ddb, tableName, limit, exclusiveStartKey }: FetchPageProps) =>
    ddb
      .query({
        TableName: tableName,
        IndexName: indexName,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ScanIndexForward: scanIndexForward,
      })
      .promise();

/**
 * For use in listWithPaginationParameters, fetches a page using a dynamodb query for a particular hash key
 * @param key the key attribute name
 * @param value the value of the key to query for
 * @param extraProps additional options for the query
 */
export const fetchPageWithQueryForHashKeyEquals = (
  key: string,
  value: string,
  extraProps?: FetchPageWithQueryExtraProps,
): PageFetcher =>
  fetchPageWithQuery({
    keyConditionExpression: '#key = :value',
    expressionAttributeNames: { '#key': key },
    expressionAttributeValues: { ':value': value },
    ...extraProps,
  });

/**
 * List all items in the given dynamodb table with pagination
 * @param ddb dynamodb document client
 * @param tableName name of the table to list
 * @param nextToken optional nextToken to continue a paginated request
 * @param limit optional limit for total returned items across all paginated requests, default is fetch all
 * @param pageSize optional number of items to return per page, default to 100
 * @param fetchPage method for retrieving a page, default is dynamodb scan
 * @param disableCounting disable counting items
 */
export const listWithPaginationParameters = async <T>(
  ddb: DynamoDB.DocumentClient,
  tableName: string,
  { nextToken, limit, pageSize }: PaginationParameters,
  fetchPage: PageFetcher = fetchPageWithScan(),
  disableCounting = false,
): Promise<PaginatedItemsResponse<T>> => {
  // Get the pagination details from the nextToken if specified
  let paginationDetails: PaginationToken | undefined;
  try {
    paginationDetails = fromToken<PaginationToken>(nextToken);
  } catch (e) {
    return { error: `Invalid nextToken ${nextToken}`, items: [] };
  }

  // The number of items we still need to fetch for this "session" of paginated requests. This will be undefined if
  // no limit was specified.
  const remainingBeforeThisPage = paginationDetails?.remaining || limit;

  // Retrieve a page of items from dynamodb
  const response = await fetchPage({
    ddb,
    tableName,
    // We don't ask for more items than are remaining to fetch if a limit was specified
    limit: Math.min(pageSize || DEFAULT_PAGE_SIZE, remainingBeforeThisPage || DEFAULT_PAGE_SIZE),
    exclusiveStartKey: paginationDetails?.lastEvaluatedKey,
  });

  const items = (response.Items || []) as T[];

  // Build the new next token
  let newToken: PaginationToken | undefined;
  if (response.LastEvaluatedKey) {
    // There are more items that can be fetched from dynamodb
    if (remainingBeforeThisPage) {
      // We had a limit, so check if we have reached that limit
      const remaining = remainingBeforeThisPage - items.length;
      if (remaining > 0) {
        // There are still more items to fetch, "remember" this in the token so we can honour the limit over multiple
        // paginated requests
        newToken = { lastEvaluatedKey: response.LastEvaluatedKey, remaining };
      }
    } else {
      // No limit was specified, so we don't set a remaining number of items to fetch
      newToken = { lastEvaluatedKey: response.LastEvaluatedKey };
    }
  }

  // get the total number of items
  const paginationTotals = disableCounting ? undefined : await getTotals(ddb, tableName);

  return {
    items,
    // @ts-ignore: NOTE: improve pagination reference during initial spec generation
    nextToken: toToken<PaginationToken>(newToken),
    totalItems: paginationTotals?.count,
  };
};

/**
 * Apply the given transactions in batches of the max supported dynamodb transaction size
 * @param ddb dynamodb document client
 * @param transactions transactions to apply
 */
export const batchTransactWrite = async (ddb: DynamoDB.DocumentClient, transactions: TransactWriteItem[]) => {
  for (const transactionBatch of chunk(transactions, DYNAMODB_MAX_TRANSACTION_ITEMS)) {
    await ddb
      .transactWrite({
        TransactItems: transactionBatch,
      })
      .promise();
  }
};

/**
 * Helper class for interacting with dynamodb
 */
export class GenericDynamodbStore<Key, Document> {
  private readonly ddb: DynamoDB.DocumentClient;
  public readonly tableName: string;
  private readonly disableCounting: boolean;
  private readonly log: Logger;

  /**
   * Create an instance of the store
   * @param ddb dynamodb document client
   * @param tableName the table name to return
   * @param disableCounting set to true to disable counting entities
   */
  public constructor(ddb: DynamoDB.DocumentClient, tableName: string, disableCounting = true) {
    this.ddb = ddb;
    this.tableName = tableName;
    this.disableCounting = disableCounting;
    this.log = new Logger({
      tags: [tableName],
    });
    if (!disableCounting && !process.env.COUNTER_TABLE_NAME) {
      throw new VError(
        { name: 'EnvironmentVariableNotSetError' },
        'process.env.COUNTER_TABLE_NAME is not set in env variables',
      );
    }
  }

  /**
   * Get a document
   * @param key the key of the document to return
   */
  public get = async (key: Key): Promise<(Document & CreateAndUpdateDetails) | undefined> => {
    const result = await this.ddb
      .get({
        TableName: this.tableName,
        Key: key,
      })
      .promise();
    return result.Item as (Document & CreateAndUpdateDetails) | undefined;
  };

  /**
   * Get total counts for each table from counter table
   * @param key the key of the document to return
   */
  public getTotalsCounter = async (tableName: string): Promise<PaginationTotals | undefined> => {
    if (this.disableCounting) {
      throw new VError({ name: 'CountingDisabledError' }, 'Cannot get totals when counting is disabled');
    }
    return getTotals(this.ddb, tableName);
  };

  /**
   * Get a batch of documents as an object
   * @param keys keys of documents to fetch
   * @param keyBy returns the string to key each document by in the result object
   */
  public batchGet = async (keys: Key[], keyBy: (doc: Document) => string): Promise<{ [key: string]: Document }> => {
    let results = {};
    const uniqueKeys = uniqWith(keys, isEqual);

    for (const keyBatch of chunk(uniqueKeys, DYNAMODB_MAX_BATCH_GET_ITEMS)) {
      const result = await this.ddb
        .batchGet({
          RequestItems: {
            [this.tableName]: {
              Keys: keyBatch,
            },
          },
        })
        .promise();

      if (result.Responses) {
        const tableResponses = result.Responses[this.tableName];
        results = {
          ...results,
          ...Object.fromEntries(tableResponses.map((response) => [keyBy(response as Document), response])),
        };
      }
    }
    return results;
  };

  private validateKeyMatchesDocument = (key: Key, document: Document) => {
    const mismatchingKeys = Object.keys(key).filter(
      (k) => !(k in document) || (document as any)[k] !== (key as any)[k],
    );
    if (mismatchingKeys.length > 0) {
      throw new VError(
        { name: 'MismatchingKeysError' },
        `Found mismatching keys in key ${key} and document ${document}`,
      );
    }
  };

  private matchKeysAndDocuments = (keys: Key[], documents: Document[]): [Key, Document][] => {
    const keysAndDocuments = zip(keys, documents);
    if (keysAndDocuments.some(([key, document]) => !key || !document)) {
      throw new VError({ name: 'KeysAndDocumentMismatchError' }, 'The provided keys and documents do not match');
    }
    keysAndDocuments.forEach(([key, document]) => this.validateKeyMatchesDocument(key as Key, document as Document));
    return keysAndDocuments as [Key, Document][];
  };

  /**
   * Write a batch of documents
   * @param keys the keys of the documents to write
   * @param documents the documents to write
   * @param userId the user creating/updating the document
   */
  public batchPut = async (
    keys: Key[],
    documents: Document[],
    userId: string,
    forceUpdate?: boolean,
  ): Promise<(Document & CreateAndUpdateDetails)[]> => {
    const keysAndDocuments = this.matchKeysAndDocuments(keys, documents);

    const results = [];
    for (const documentAndKeyBatch of chunk(keysAndDocuments, DYNAMODB_MAX_TRANSACTION_ITEMS)) {
      results.push(
        ...(await Promise.all(
          documentAndKeyBatch.map(async ([key, document]) => this.put(key, userId, document, forceUpdate)),
        )),
      );
    }
    return results;
  };

  /**
   * Adds create and update details to the given document by checking whether it exists or not
   * @param key key of the document
   * @param userId user performing the create/update
   * @param document document to add details to
   */
  private addCreateAndUpdateDetails = async (
    key: Key,
    userId: string,
    document: Document,
    existingDocument: Document,
  ): Promise<Document & CreateAndUpdateDetails> => {
    // Construct the document to write to dynamodb (including the appropriate create and update details)
    const createAndUpdateDetails = getCreateAndUpdateDetails(userId, existingDocument);
    return {
      ...document,
      ...createAndUpdateDetails,
      ...key,
    };
  };

  /**
   * Create or update a document
   * @param key the key of the document to write
   * @param userId the id of the user performing the operation
   * @param document the document to write
   */
  /* eslint-disable sonarjs/cognitive-complexity */
  public put = async (
    key: Key,
    userId: string,
    document: Document & CreateAndUpdateDetails,
    forceUpdate?: boolean,
  ): Promise<Document & CreateAndUpdateDetails> => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    // First, retrieve the existing document if any
    const existingDocument = await this.get(key);
    const log = this.log;

    // Always allow the system user to update (necessary for deployment updates)
    if (existingDocument && userId === DefaultUser.SYSTEM && forceUpdate !== false) {
      forceUpdate = true;
    }

    log.trace('put', {
      key,
      userId,
      document,
      forceUpdate,
      existingDocument,
    });

    // get the document updated timestamp, if forceUpdate, then we try to use existing document timestamp to differentiate between create and update
    const documentUpdatedTimestamp = forceUpdate ? existingDocument?.updatedTimestamp : document?.updatedTimestamp;

    const documentToWrite = await this.addCreateAndUpdateDetails(key, userId, document, existingDocument as Document);

    // this handles both update on an deleted item or updates on existing item
    // this also handles creation on an existing item
    if (documentUpdatedTimestamp) {
      log.debug(` ==== ddb update operation ==== ${documentUpdatedTimestamp} ${existingDocument?.updatedTimestamp}`);
      try {
        await this.ddb
          .put({
            TableName: this.tableName,
            Item: documentToWrite,
            ExpressionAttributeValues: {
              ':updatedTimestamp': documentUpdatedTimestamp,
            },
            ConditionExpression: `updatedTimestamp = :updatedTimestamp`,
          })
          .promise();
      } catch (error: any) {
        if (error.code === 'ConditionalCheckFailedException') {
          throw new VError(
            { name: 'ItemFailedUpdateError' },
            'Item cannot be updated. This is because it was updated somewhere else. You need to reload and redo your changes.',
          );
        } else {
          throw error;
        }
      }
    } else {
      log.debug(` ==== ddb create operation ==== ${documentUpdatedTimestamp}`);
      try {
        await this.ddb
          .put({
            TableName: this.tableName,
            Item: documentToWrite,
            ConditionExpression: `attribute_not_exists(updatedTimestamp)`,
          })
          .promise();
      } catch (error: any) {
        if (error.code === 'ConditionalCheckFailedException') {
          throw new VError({ name: 'ItemIdAlreadyExistsError' }, `Item with same id already exists.`);
        } else {
          throw error;
        }
      }
    }
    return documentToWrite;
  };
  /* eslint-enable sonarjs/cognitive-complexity */

  /**
   * Delete the document if it exists
   * @param key key of the document to delete
   */
  public deleteIfExists = async (key: Key): Promise<(Document & CreateAndUpdateDetails) | undefined> => {
    const documentToDelete = await this.get(key);
    if (documentToDelete) {
      await this.ddb
        .transactWrite({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: key,
              },
            },
            ...(this.disableCounting ? [] : [updateCounter(this.tableName, -1)]),
          ],
        })
        .promise();
    }
    return documentToDelete;
  };

  /**
   * Delete a batch of documents
   * @param keys the keys of the documents to delete
   */
  public batchDeleteIfExists = async (keys: Key[]): Promise<((Document & CreateAndUpdateDetails) | undefined)[]> => {
    const results = [];
    for (const keyBatch of chunk(keys, DYNAMODB_MAX_TRANSACTION_ITEMS)) {
      results.push(...(await Promise.all(keyBatch.map(async (key) => this.deleteIfExists(key)))));
    }
    return results;
  };

  /**
   * List documents in the store
   * @param paginationParameters describing the items to fetch in this page
   * @param fetchPage optional function to determine how a page of documents are fetched. Default is ddb scan.
   */
  public list = (
    paginationParameters: PaginationParameters,
    fetchPage?: PageFetcher,
  ): Promise<PaginatedItemsResponse<Document>> => {
    return listWithPaginationParameters<Document>(
      this.ddb,
      this.tableName,
      paginationParameters,
      fetchPage,
      this.disableCounting,
    );
  };

  /**
   * Performs a full scan of the table to return all items (following all pages)
   */
  public scanAll = (): Promise<Document[]> =>
    paginatedRequest<DynamoDB.Types.ScanInput>(
      this.ddb.scan.bind(this.ddb),
      {
        TableName: this.tableName,
      },
      'Items',
      'LastEvaluatedKey',
      'ExclusiveStartKey',
    );
}

/**
 * Update counter in counter table
 * @param tableName the PK of counter table
 * @param incr either increment by 1 or decrement by 1
 * @returns
 */
export const updateCounter = (tableName: string, incr: number) => ({
  Update: {
    TableName: process.env.COUNTER_TABLE_NAME!,
    UpdateExpression: 'set #count = #count + :num',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':num': incr },
    Key: {
      tableName,
    },
  },
});
