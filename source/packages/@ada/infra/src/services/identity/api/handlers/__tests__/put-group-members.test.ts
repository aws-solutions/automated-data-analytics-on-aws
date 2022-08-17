/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import * as _ from 'lodash';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import {
  DEFAULT_CALLER,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { GroupEntity } from '@ada/api';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-group-members';

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('put-group-members', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const createUpdateDetails = {
    createdBy: 'group-creator',
    updatedBy: DEFAULT_CALLER.userId,
    createdTimestamp: now,
    updatedTimestamp: now,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const putGroupHelper = (groupId: string, group: Omit<GroupEntity, 'groupId'>) =>
    testGroupStore.putGroup(groupId, 'group-creator', group);

  // Helper method for calling the handler
  const putGroupMembersHandler = (
    groupId: string,
    members: Pick<GroupEntity, 'members'>,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { groupId },
        body: members,
      }) as any,
      null,
    );

  it.each(['group-creator', DefaultGroupIds.ADMIN])(
    'should allow %s to add new members to the group',
    async (callingUserId) => {
      const existing = {
        apiAccessPolicyIds: ['api1'],
        members: ['m1'],
        claims: ['c1'],
      };
      await putGroupHelper('group1', existing);

      const result = await putGroupMembersHandler(
        'group1',
        {
          members: ['m2', 'm3'],
        },
        {
          ...DEFAULT_CALLER,
          userId: callingUserId,
          groups: [callingUserId],
        },
      );

      expect(JSON.parse(result.body)).toStrictEqual({
        ...existing,
        groupId: 'group1',
        members: ['m1', 'm2', 'm3'],
        ...createUpdateDetails,
        updatedBy: callingUserId,
      });
    },
  );

  it('should forbid adding members for a non group owner', async () => {
    const existing = {
      apiAccessPolicyIds: ['api1'],
      members: ['m1'],
      claims: ['c1'],
    };
    await putGroupHelper('group1', existing);

    const response = await putGroupMembersHandler(
      'group1',
      {
        members: ['m2', 'm3'],
      },
      {
        ...DEFAULT_CALLER,
        userId: 'unauthorized-user',
        groups: ['analyst'],
      },
    );

    expect(response.statusCode).toBe(403);
  });

  it('should throw an error if the group does not exist', async () => {
    const result = await putGroupMembersHandler('group1', {
      members: ['m2', 'm3'],
    });

    expect(JSON.parse(result.body)).toStrictEqual({
      message: 'Not Found: no group was found with groupId group1',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });

  it('should add unique members if duplicates are provided as input', async () => {
    const existing = {
      apiAccessPolicyIds: ['api1'],
      members: ['m1'],
      claims: ['c1'],
    };
    await putGroupHelper('group1', existing);

    const result = await putGroupMembersHandler('group1', {
      members: ['m3', 'm3'],
    });

    expect(JSON.parse(result.body)).toStrictEqual({
      ...existing,
      groupId: 'group1',
      members: ['m1', 'm3'],
      ...createUpdateDetails,
    });
  });

  it('should add unique members if merge of previous and new members generate duplicates', async () => {
    const existing = {
      apiAccessPolicyIds: ['api1'],
      members: ['m1'],
      claims: ['c1'],
    };
    await putGroupHelper('group1', existing);

    const result = await putGroupMembersHandler('group1', {
      members: ['m1', 'm2'],
    });

    expect(JSON.parse(result.body)).toStrictEqual({
      ...existing,
      groupId: 'group1',
      members: ['m1', 'm2'],
      ...createUpdateDetails,
    });
  });
});
