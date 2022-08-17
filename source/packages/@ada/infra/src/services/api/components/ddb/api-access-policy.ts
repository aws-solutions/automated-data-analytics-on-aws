/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicy, CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { GenericDynamodbStore } from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { API_ACCESS_POLICY_TABLE_NAME } = process.env;

export type ApiAccessPolicyWithCreateUpdateDetails = ApiAccessPolicy & CreateAndUpdateDetails;

/**
 * The structure of a response when listing api access policies
 */
export interface ListApiAccessPoliciesResponse extends PaginatedResponse {
  readonly policies: ApiAccessPolicy[];
  readonly error?: string;
}

type ApiAccessPolicyIdentifier = Pick<ApiAccessPolicy, 'apiAccessPolicyId'>;

/**
 * Class for interacting with ApiAccessPolicies in dynamodb
 */
export class ApiAccessPolicyStore {
  // Singleton instance of the api access policy store
  private static instance: ApiAccessPolicyStore | undefined;

  /**
   * Get an instance of the api access policy store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): ApiAccessPolicyStore =>
    ApiAccessPolicyStore.instance || new ApiAccessPolicyStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly apiAccessPolicyStore: GenericDynamodbStore<ApiAccessPolicyIdentifier, ApiAccessPolicy>;

  /**
   * Create an instance of the api access policy store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.apiAccessPolicyStore = new GenericDynamodbStore<ApiAccessPolicyIdentifier, ApiAccessPolicy>(
      ddb,
      API_ACCESS_POLICY_TABLE_NAME ?? '',
    );
  }

  /**
   * Get an api access policy if present
   * @param apiAccessPolicyId the id of the api access policy
   */
  public getApiAccessPolicy = async (
    apiAccessPolicyId: string,
  ): Promise<ApiAccessPolicyWithCreateUpdateDetails | undefined> =>
    (await this.batchGetApiAccessPolicies([apiAccessPolicyId]))[apiAccessPolicyId];

  /**
   * Retrieve a list of ApiAccessPolicy based on api access policy ids
   * @param apiAccessPolicies the api access policy ids to retrieve
   */
  public batchGetApiAccessPolicies = (
    apiAccessPolicies: string[],
  ): Promise<{ [apiAccessPolicyId: string]: ApiAccessPolicyWithCreateUpdateDetails }> => {
    return this.apiAccessPolicyStore.batchGet(
      apiAccessPolicies.map((apiAccessPolicyId) => ({ apiAccessPolicyId })),
      (mapping) => mapping.apiAccessPolicyId,
    );
  };

  /**
   * Create or update an api access policy
   * @param apiAccessPolicyId the id of the api access policy to create/update
   * @param userId the id of the user performing the operation
   * @param apiAccessPolicy the api access policy to write
   * @param force force update
   */
  public putApiAccessPolicy = async (
    apiAccessPolicyId: string,
    userId: string,
    apiAccessPolicy: ApiAccessPolicy,
    force?: boolean,
  ): Promise<ApiAccessPolicyWithCreateUpdateDetails> =>
    this.apiAccessPolicyStore.put({ apiAccessPolicyId }, userId, apiAccessPolicy, force);

  /**
   * Delete an api access policy if present
   * @param apiAccessPolicyId the id of the api access policy
   */
  public deleteApiAccessPolicyIfExists = (
    apiAccessPolicyId: string,
  ): Promise<ApiAccessPolicyWithCreateUpdateDetails | undefined> =>
    this.apiAccessPolicyStore.deleteIfExists({ apiAccessPolicyId });

  /**
   * List all api access policies in the store
   * @param paginationParameters options for pagination
   */
  public listApiAccessPolicies = async (
    paginationParameters: PaginationParameters,
  ): Promise<ListApiAccessPoliciesResponse> => {
    const result = await this.apiAccessPolicyStore.list(paginationParameters);
    return { policies: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };
}
