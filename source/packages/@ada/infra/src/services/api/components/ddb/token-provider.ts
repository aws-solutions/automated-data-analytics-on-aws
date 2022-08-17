/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import {
  GenericDynamodbStore,
  Token,
  batchTransactWrite,
  fetchPageWithQueryForHashKeyEquals,
  updateCounter,
} from '@ada/infra/src/common/services';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { TOKEN_TABLE_NAME, MACHINE_TABLE_NAME, TOKEN_CLIENT_ID_INDEX_NAME } = process.env;

export type TokenWithCreateUpdateDetails = Token & CreateAndUpdateDetails;

type TokenIdentifier = Pick<Token, 'machineId' | 'tokenId'>;
type TokenIdentifierClientId = Pick<Token, 'clientId'>;

/**
 * The structure of a response when listing tokens
 */
export interface ListTokenResponse extends PaginatedResponse {
  readonly tokens: TokenWithCreateUpdateDetails[];
  readonly error?: string;
}

/**
 * Class for interacting with identity tokens in dynamodb
 */
export class TokenStore {
  // Singleton instance of the token store
  private static instance: TokenStore | undefined;

  /**
   * Get an instance of the token store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): TokenStore => TokenStore.instance || new TokenStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly tokenStore: GenericDynamodbStore<TokenIdentifier | TokenIdentifierClientId, Token>;

  /**
   * Create an instance of the token store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.tokenStore = new GenericDynamodbStore<TokenIdentifier | TokenIdentifierClientId, Token>(
      ddb,
      TOKEN_TABLE_NAME ?? '',
    );
  }

  /**
   * Get a token if present
   * @param machineId the id of the machine
   * @param tokenId the id of the token
   * @returns the token, if exists, undefined otherwise
   */
  public getToken = (machineId: string, tokenId: string): Promise<TokenWithCreateUpdateDetails | undefined> =>
    this.tokenStore.get({ machineId, tokenId });

  /**
   * Return the token that has the clientId provided as input
   * @param clientId the client id to be used to retrieve the token for
   * @returns the token, if exists, undefined otherwise
   */
  public getTokenByClientId = async (clientId: string): Promise<TokenWithCreateUpdateDetails | undefined> => {
    const res = await fetchPageWithQueryForHashKeyEquals('clientId', clientId, {
      indexName: TOKEN_CLIENT_ID_INDEX_NAME,
    })({
      ddb: this.ddb,
      limit: 1,
      tableName: TOKEN_TABLE_NAME ?? '',
    });

    // the clientId is the partition key of the GSI, we are expecting only one item
    return (res.Items || []).length > 0 ? res.Items![0] : undefined;
  };

  /**
   * Delete a token if present
   * @param machineId the id of the machine
   * @param tokenId the id of the token
   */
  public deleteTokenIfExists = (
    machineId: string,
    tokenId: string,
  ): Promise<TokenWithCreateUpdateDetails | undefined> => this.tokenStore.deleteIfExists({ machineId, tokenId });

  /**
   * Create or update a token
   * @param machineId the id of the machine
   * @param tokenId the id of the token to create/update
   * @param userId the id of the user performing the operation
   * @param token the token to write
   */
  public putToken = (
    machineId: string,
    tokenId: string,
    userId: string,
    token: Token,
  ): Promise<TokenWithCreateUpdateDetails> => this.tokenStore.put({ machineId, tokenId }, userId, token);

  /**
   * List all tokens for the given machine
   * @param machineId the machine to fetch tokens for
   * @param paginationParameters options for pagination
   * @param deleteSecret determine whether to delete or not the hashed secret from the response
   */
  public listTokens = async (
    machineId: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListTokenResponse> => {
    const result = await this.tokenStore.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('machineId', machineId),
    );

    return { tokens: result.items, nextToken: result.nextToken, error: result.error };
  };

  /**
   * Remove all the provided tokens from the token table
   * @param machineId the id of the machine to be deleted
   * @param tokenIds list of machineId/tokenId pair to be deleted
   * @returns the token ids that have been removed
   */
  public deleteMachineAndTokens = async (machineId: string, tokenIds: string[]) => {
    await batchTransactWrite(this.ddb, [
      ...tokenIds.map((tokenId) => ({
        Delete: {
          TableName: TOKEN_TABLE_NAME ?? '',
          Key: {
            machineId,
            tokenId,
          },
        },
      })),
      updateCounter(TOKEN_TABLE_NAME ?? '', -1 * tokenIds.length),
      {
        Delete: {
          TableName: MACHINE_TABLE_NAME ?? '',
          Key: {
            machineId,
          },
        },
      },
      updateCounter(MACHINE_TABLE_NAME ?? '', -1),
    ]);

    return tokenIds;
  };
}
