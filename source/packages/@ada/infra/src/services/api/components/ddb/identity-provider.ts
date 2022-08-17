/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import { ExternalIdentityProvider, GenericDynamodbStore } from '@ada/infra/src/common/services';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { IDENTITY_PROVIDER_TABLE_NAME } = process.env;

export type ExternalIdentityProviderWithCreateUpdateDetails = ExternalIdentityProvider & CreateAndUpdateDetails;

type IdentityProviderIdentifier = Pick<ExternalIdentityProvider, 'identityProviderId'>;

/**
 * The structure of a response when listing identity providers
 */
export interface ListExternalIdentityProvidersResponse extends PaginatedResponse {
  readonly providers: ExternalIdentityProviderWithCreateUpdateDetails[];
  readonly error?: string;
}

/**
 * Class for interacting with identity providers in dynamodb
 */
export class IdentityProviderStore {
  // Singleton instance of the identity store
  private static instance: IdentityProviderStore | undefined;

  /**
   * Get an instance of the identity store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): IdentityProviderStore =>
    IdentityProviderStore.instance || new IdentityProviderStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly identityStore: GenericDynamodbStore<IdentityProviderIdentifier, ExternalIdentityProvider>;

  /**
   * Create an instance of the identity provider store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.identityStore = new GenericDynamodbStore<IdentityProviderIdentifier, ExternalIdentityProvider>(
      ddb,
      IDENTITY_PROVIDER_TABLE_NAME ?? '' ,
    );
  }

  /**
   * Get an identity provider if present
   * @param identityProviderId the id of the identity provider
   */
  public getIdentityProvider = async (
    identityProviderId: string,
  ): Promise<ExternalIdentityProviderWithCreateUpdateDetails | undefined> =>
    this.identityStore.get({ identityProviderId });

  /**
   * Create or update an identity provider
   * @param identityProviderId the id of the identity provider to create/update
   * @param userId the id of the user performing the operation
   * @param identityProvider the identity provider to write
   */
  public putIdentityProvider = async (
    identityProviderId: string,
    userId: string,
    identityProvider: ExternalIdentityProvider,
  ): Promise<ExternalIdentityProviderWithCreateUpdateDetails> =>
    this.identityStore.put({ identityProviderId }, userId, identityProvider);

  /**
   * Delete an identity provider if present
   * @param identityProviderId the id of the identity provider
   */
  public deleteIdentityProviderIfExists = async (
    identityProviderId: string,
  ): Promise<ExternalIdentityProviderWithCreateUpdateDetails | undefined> =>
    this.identityStore.deleteIfExists({ identityProviderId });

  /**
   * List all identity provider
   * @param paginationParameters options for pagination
   */
  public listIdentityProvider = async (
    paginationParameters: PaginationParameters,
  ): Promise<ListExternalIdentityProvidersResponse> => {
    const result = await this.identityStore.list(paginationParameters);

    return { providers: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };
}
