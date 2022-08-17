/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import {
  FetchPageProps,
  GenericDynamodbStore,
  listWithPaginationParameters,
  paginatedRequest,
} from '@ada/infra/src/common/services';
import { Group, GroupEntity, PaginatedResponse } from '@ada/api';
import { PaginationParameters } from '@ada/api-gateway';
import { intersection, uniq } from 'lodash';

// Table names are passed as environment variables defined in the CDK infrastructure
const { GROUP_TABLE_NAME } = process.env;

export type GroupWithCreateUpdateDetails = GroupEntity;

type GroupIdentifier = Pick<Group, 'groupId'>;

/**
 * The structure of a group mapping entry in the groups table
 */
export interface GroupMapping {
  groupIds: string[];
}

/**
 * The structure of a response when listing groups
 */
export interface ListGroupsResponse extends PaginatedResponse {
  readonly groups: Group[];
  readonly error?: string;
}

/**
 * Class for interacting with groups in dynamodb
 */
export class GroupStore {
  // Singleton instance of the group store
  private static instance: GroupStore | undefined;

  /**
   * Get an instance of the group store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): GroupStore => GroupStore.instance || new GroupStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly groupStore: GenericDynamodbStore<GroupIdentifier, Group>;

  /**
   * Create an instance of the group store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.groupStore = new GenericDynamodbStore<GroupIdentifier, Group>(ddb, GROUP_TABLE_NAME ?? '');
  }

  /**
   * Get a group if present
   * @param groupId the id of the group
   */
  public getGroup = (groupId: string): Promise<GroupWithCreateUpdateDetails | undefined> =>
    this.groupStore.get({ groupId });

  /**
   * Retrieve a list of groups based on group ids
   * @param groups the group names to retrieve
   */
  public batchGetGroups = (groupIds: string[]): Promise<{ [groupId: string]: GroupWithCreateUpdateDetails }> => {
    return this.groupStore.batchGet(
      groupIds.map((groupId) => ({ groupId })),
      (mapping) => mapping.groupId,
    );
  };

  /**
   * Get a group claim if present
   * @param claim the claim name
   */
  public getClaim = async (claim: string): Promise<GroupMapping | undefined> =>
    (await this.batchGetClaims([claim]))[claim];

  /**
   * Retrieve the groups that map to the given claims. Claims that do not exist are omitted from the response.
   * @param claims the claim names to retrieve
   */
  public batchGetClaims = async (claims: string[]): Promise<{ [claim: string]: GroupMapping }> => {
    return this.scanByList(claims, 'claims');
  };

  /**
   * Get a group member if present
   * @param member the member name
   */
  public getMember = async (member: string): Promise<GroupMapping | undefined> =>
    (await this.batchGetMembers([member]))[member];

  /**
   * Retrieve the groups that map to the given members. Members that do not exist are omitted from the response.
   * @param members the member names to retrieve
   */
  public batchGetMembers = async (members: string[]): Promise<{ [member: string]: GroupMapping }> => {
    return this.scanByList(members, 'members');
  };

  /**
   * Create or update a group
   * @param groupId the id of the group to create/update
   * @param userId the id of the user performing the operation
   * @param group the group to write
   * @param force force the update
   */
  public putGroup = async (
    groupId: string,
    userId: string,
    group: Group,
    force?: boolean,
  ): Promise<GroupWithCreateUpdateDetails> => {
    return this.groupStore.put({ groupId }, userId, group, force);
  };

  /**
   * Delete a group if present
   * @param groupId the id of the group to delete
   */
  public deleteGroupIfExists = (groupId: string): Promise<GroupWithCreateUpdateDetails | undefined> =>
    this.groupStore.deleteIfExists({ groupId });

  /**
   * List a page of groups
   * @param paginationParameters details about the page to request
   */
  public listGroups = async (paginationParameters: PaginationParameters): Promise<ListGroupsResponse> => {
    const result = await this.groupStore.list(paginationParameters);
    return { groups: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };

  /**
   * Scan a table and retrieve groups that match any value of the specified claims array
   * @param list an array of claims to search for
   * @param attributeName attribute in the group table
   * @returns
   */
  public scanByList = async (list: string[], attributeName: string): Promise<{ [key: string]: GroupMapping }> => {
    const results: { [key: string]: GroupMapping } = {};
    const filterExpression = list.map((_x, i) => `contains(#col${i}, :col${i})`).join(' Or ');

    const names: { [key: string]: string } = {};
    list.forEach((_, i) => {
      names[`#col${i}`] = attributeName;
    });

    const values: { [key: string]: any } = {};
    list.forEach((value, i) => {
      values[`:col${i}`] = value;
    });

    const tableResponses = await paginatedRequest<DynamoDB.Types.ScanInput>(
      this.ddb.scan.bind(this.ddb),
      {
        TableName: this.groupStore.tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      },
      'Items',
      'LastEvaluatedKey',
      'ExclusiveStartKey',
    );

    tableResponses.forEach((_value, i) => {
      // get first and only element from intersection
      const commonElements = intersection(list, tableResponses[i][attributeName]);
      commonElements.forEach((element) => {
        if (!results[element]) {
          results[element] = {
            groupIds: [],
          };
        }
        results[element].groupIds.push(tableResponses[i].groupId);
      });
    });

    return results;
  };

  /**
   * Filter the groups using a custom attribute
   * @param attributeName the name of the attribute to filter for
   * @param attributeValue the value to build the condition with
   * @param paginationParameters pagination parameters
   * @returns a group response with the list of groups that met the condition
   */
  public filterGroupsByAttribute = async (
    attributeName: string,
    attributeValue: any,
    paginationParameters: PaginationParameters,
  ): Promise<ListGroupsResponse> => {
    const result = await listWithPaginationParameters<Group>(
      this.ddb,
      GROUP_TABLE_NAME ?? '',
      paginationParameters,
      ({ ddb, tableName, limit, exclusiveStartKey }: FetchPageProps) =>
        ddb
          .scan({
            TableName: tableName,
            Limit: limit,
            ExclusiveStartKey: exclusiveStartKey,
            FilterExpression: '#attr = :attrVal',
            ExpressionAttributeNames: {
              '#attr': attributeName,
            },
            ExpressionAttributeValues: {
              ':attrVal': attributeValue,
            },
          })
          .promise(),
    );

    return { groups: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };

  /**
   * Add new members to an existing group
   * @param groupId the id of the group to add members for
   * @param userId the user that is performing the operation
   * @param newMembers the list of new members to add
   * @returns the updated group
   */
  public addMembers = async (
    groupId: string,
    userId: string,
    newMembers: string[],
  ): Promise<GroupWithCreateUpdateDetails | undefined> => {
    const existingGroup = (await this.getGroup(groupId))!;

    return this.putGroup(groupId, userId, {
      ...existingGroup,
      members: uniq([...existingGroup.members, ...newMembers]),
    });
  };
}
