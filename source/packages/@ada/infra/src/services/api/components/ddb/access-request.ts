/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequest } from '@ada/api-client';
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import { GenericDynamodbStore, fetchPageWithScan } from '@ada/infra/src/common/services';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { ACCESS_REQUEST_TABLE_NAME } = process.env;

export type AccessRequestWithCreateUpdateDetails = AccessRequest & CreateAndUpdateDetails;

type AccessRequestIdentifier = Pick<AccessRequest, 'groupId' | 'userId'>;

/**
 * The structure of a response when listing access requests
 */
export interface ListAccessRequestResponse extends PaginatedResponse {
  readonly accessRequests: AccessRequestWithCreateUpdateDetails[];
  readonly error?: string;
}

/**
 * Class for interacting with users requesting access to groups in dynamodb
 */
export class AccessRequestStore {
  // Singleton instance of the accessRequest store
  private static instance: AccessRequestStore | undefined;

  /**
   * Get an instance of the accessRequest store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): AccessRequestStore =>
    AccessRequestStore.instance || new AccessRequestStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly accessRequestStore: GenericDynamodbStore<AccessRequestIdentifier, AccessRequest>;

  /**
   * Create an instance of the accessRequest store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.accessRequestStore = new GenericDynamodbStore<AccessRequestIdentifier, AccessRequest>(
      ddb,
      ACCESS_REQUEST_TABLE_NAME ?? '',
    );
  }

  /**
   * Get a specific accessRequest by groupId and userId
   * @param groupId group to be added to
   * @param userId user id requesting access
   * @returns
   */
  public getAccessRequest = (
    groupId: string,
    userId: string,
  ): Promise<AccessRequestWithCreateUpdateDetails | undefined> => this.accessRequestStore.get({ groupId, userId });

  /**
   * Delete by groupId and userId
   * @param groupId the id of the group
   * @param userId the id of the user performing the operation
   * @returns
   */
  public deleteAccessRequestIfExists = (
    groupId: string,
    userId: string,
  ): Promise<AccessRequestWithCreateUpdateDetails | undefined> =>
    this.accessRequestStore.deleteIfExists({ groupId, userId });

  /**
   * Create or update a accessRequest
   * @param accessRequestIdentifier the id of the group
   * @param userId the id of the user performing the operation
   * @param accessRequest the accessRequest to write
   */
  public putAccessRequest = (
    accessRequestIdentifier: AccessRequestIdentifier,
    userId: string,
    accessRequest: AccessRequest,
  ): Promise<AccessRequestWithCreateUpdateDetails> =>
    this.accessRequestStore.put(accessRequestIdentifier, userId, accessRequest);

  /**
   * List all accessRequest
   * @param paginationParameters options for pagination
   */
  public listAccessRequest = async (paginationParameters: PaginationParameters): Promise<ListAccessRequestResponse> => {
    const result = await this.accessRequestStore.list(paginationParameters);

    return {
      accessRequests: result.items,
      nextToken: result.nextToken,
      error: result.error,
    };
  };

  /**
   * List all access requests for the given list of groups and users. Returns access requests that involve either the
   * groups or the users (or both). User "involvement" means the user created the access request, or the access request
   * pertains to that user (usually these are the same but it is possible to request access on behalf of another user).
   * @param paginationParameters options for pagination
   * @param groupIds the groups to list requests for
   * @param userIds the userIds to list requests for
   */
  public listAccessRequestsForGroupsOrUsers = async (
    paginationParameters: PaginationParameters,
    groupIds: string[],
    userIds: string[],
  ): Promise<ListAccessRequestResponse> => {
    const groupAttributeValues = Object.fromEntries(groupIds.map((groupId, i) => [`:group_${i}`, groupId]));
    const userAttributeValues = Object.fromEntries(userIds.map((userId, i) => [`:user_${i}`, userId]));

    const buildInFilter = (attributeName: string, values: string[]) =>
      values.length > 0 ? `${attributeName} IN (${values.join(',')})` : undefined;

    // NOTE: Since filter expressions are processed after the limit, page size may be smaller than expected, so we may
    // wish to implement fetching multiple ddb pages to build a single requested page in the generic ddb store in future
    const matchingGroups = buildInFilter('#groupId', Object.keys(groupAttributeValues));
    const matchingCreatedBy = buildInFilter('#createdBy', Object.keys(userAttributeValues));
    const matchingUserId = buildInFilter('#userId', Object.keys(userAttributeValues));
    const result = await this.accessRequestStore.list(
      paginationParameters,
      fetchPageWithScan({
        filterExpression: [matchingGroups, matchingCreatedBy, matchingUserId].filter((x) => x).join(' OR '),
        expressionAttributeNames: {
          ...(matchingGroups ? { '#groupId': 'groupId' } : {}),
          ...(matchingCreatedBy ? { '#createdBy': 'createdBy' } : {}),
          ...(matchingUserId ? { '#userId': 'userId' } : {}),
        },
        expressionAttributeValues: {
          ...groupAttributeValues,
          ...userAttributeValues,
        },
      }),
    );

    return {
      accessRequests: result.items,
      nextToken: result.nextToken,
      error: result.error,
    };
  };
}
