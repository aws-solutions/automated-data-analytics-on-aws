/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AccessRequest } from '@ada/api';
import { AccessRequestNotificationType, DefaultGroupIds, ROOT_ADMIN_ID } from '@ada/common';
import { AccessRequestStore } from '../../../../../api/components/ddb/access-request';
import { DefaultUser } from '@ada/microservice-common';
import { GroupStore } from '../../../../../api/components/ddb/groups';
import { INotificationClient, NotificationClient } from '../../../../../api/components/notification/client';
import { buildApiRequest } from '@ada/api-gateway';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../action';
import { jest } from '@jest/globals';
import { mocked } from 'ts-jest/utils';

// Mock the AccessRequestStore to point to our local dynamodb
const testAccessRequestStore = new (AccessRequestStore as any)(getLocalDynamoDocumentClient());
AccessRequestStore.getInstance = jest.fn(() => testAccessRequestStore);
// Mock the GroupStore to point to our local dynamodb
const testGroupStore: GroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

// Mock the NotificationClient
const mockNotificationClient: INotificationClient = {
  send: jest.fn(),
};
NotificationClient.getInstance = jest.fn(() => mockNotificationClient);

describe('action-access-request', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const createUpdateDetails = {
    createdBy: 'access-requester',
    updatedBy: 'access-requester',
  };
  const groupCreateUpdateDetails = {
    createdBy: 'group-creator',
    updatedBy: 'group-creator',
  };
  const createUpdateTimestamps = {
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
    jest.clearAllMocks();
  });

  // Helper method for calling the handler
  const approveDenyHandler = (
    groupId: string,
    userId: string,
    action: string,
    caller: string,
    groups: string[],
    accessRequest: AccessRequest,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(
        { userId: caller, username: userId, groups },
        {
          pathParameters: { groupId, userId, action },
          body: accessRequest,
        },
      ) as any,
      null,
    );

  it('should approve an access-request', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'to-be-added-user',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };

    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
    };
    await testGroupStore.putGroup('group-id', 'group-creator', group);
    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id', userId: 'to-be-added-user' },
      'access-requester',
      accessRequest,
    );

    const response = await approveDenyHandler(
      'group-id',
      'to-be-added-user',
      'approve',
      'request-approver',
      ['admin', 'analyst'],
      accessRequest,
    );

    const expected = {
      accessRequest: {
        ...accessRequest,
        ...createUpdateTimestamps,
      },
      action: 'approve',
      reason: 'APPROVE',
      caller: 'request-approver',
      timestamp: new Date().toISOString(),
    };

    // check user is added to group's members
    const expectedGroup = {
      ...group,
      updatedBy: 'request-approver',
      members: ['member-1', 'member-2', 'member-3', 'to-be-added-user'],
      ...createUpdateTimestamps,
    };

    expect(response.statusCode).toBe(200);
    const updatedGroup = await testGroupStore.getGroup('group-id');
    expect(updatedGroup).toEqual(expectedGroup);
    expect(JSON.parse(response.body)).toEqual(expected);

    // Should notify the creator of the access request, the added user, and the group owner
    expect(mocked(mockNotificationClient).send.mock.calls[0]).toIncludeSameMembers([
      expect.objectContaining({
        target: 'to-be-added-user',
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: 'group-creator',
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: 'access-requester',
        type: AccessRequestNotificationType.APPROVE,
      }),
    ]);
  });

  it('should deny an access-request', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'to-be-added-user',
      reason: 'DENY',
      // self-requested access
      createdBy: 'to-be-added-user',
      updatedBy: 'to-be-added-user',
    };

    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
    };

    await testGroupStore.putGroup('group-id', 'group-creator', group);

    // Self-requested access
    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id', userId: 'to-be-added-user' },
      'to-be-added-user',
      accessRequest,
    );

    // Group owner approving the request
    const response = await approveDenyHandler(
      'group-id',
      'to-be-added-user',
      'deny',
      'group-creator',
      ['admin', 'analyst'],
      accessRequest,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      accessRequest: {
        ...accessRequest,
        ...createUpdateTimestamps,
      },
      action: 'deny',
      reason: 'DENY',
      caller: 'group-creator',
      timestamp: new Date().toISOString(),
    });

    // Expect the group to remain unchanged
    const updatedGroup = await testGroupStore.getGroup('group-id');
    expect(updatedGroup).toEqual({ ...group, ...createUpdateTimestamps });

    // Only the user that was denied is notified, since the approver was the group owner (no need to notify of
    // synchronous action just performed)
    expect(mocked(mockNotificationClient).send.mock.calls[0]).toIncludeSameMembers([
      expect.objectContaining({
        target: 'to-be-added-user',
        type: AccessRequestNotificationType.DENY,
      }),
    ]);
  });

  // TODO: Enable if necessary in the future
  it.skip('should notify members of the admin group and the root admin when a system owned access request is approved', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'to-be-added-user',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };

    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
      createdBy: DefaultUser.SYSTEM,
    };
    await testGroupStore.putGroup('group-id', DefaultUser.SYSTEM, group);
    await testGroupStore.putGroup(DefaultGroupIds.ADMIN, DefaultUser.SYSTEM, {
      groupId: DefaultGroupIds.ADMIN,
      claims: [],
      members: ['admin-1', 'admin-2'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });

    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id', userId: 'to-be-added-user' },
      'access-requester',
      accessRequest,
    );

    const response = await approveDenyHandler(
      'group-id',
      'to-be-added-user',
      'approve',
      'request-approver',
      ['admin', 'analyst'],
      accessRequest,
    );

    const expected = {
      accessRequest: {
        ...accessRequest,
        ...createUpdateTimestamps,
      },
      action: 'approve',
      reason: 'APPROVE',
      caller: 'request-approver',
      timestamp: new Date().toISOString(),
    };

    // check user is added to group's members
    const expectedGroup = {
      ...group,
      updatedBy: 'request-approver',
      members: ['member-1', 'member-2', 'member-3', 'to-be-added-user'],
      ...createUpdateTimestamps,
    };

    expect(response.statusCode).toBe(200);
    const updatedGroup = await testGroupStore.getGroup('group-id');
    expect(updatedGroup).toEqual(expectedGroup);
    expect(JSON.parse(response.body)).toEqual(expected);

    // Should notify the creator of the access request, the added user, and the group owner
    expect(mocked(mockNotificationClient).send.mock.calls[0]).toIncludeSameMembers([
      expect.objectContaining({
        target: 'to-be-added-user',
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: 'admin-1',
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: 'admin-2',
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: ROOT_ADMIN_ID,
        type: AccessRequestNotificationType.APPROVE,
      }),
      expect.objectContaining({
        target: 'access-requester',
        type: AccessRequestNotificationType.APPROVE,
      }),
    ]);
  });

  it('should return forbidden if the user acting on the request has insufficient permissions', async () => {
    const accessRequest = {
      groupId: 'another-group-id',
      userId: 'to-be-added-user',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };

    const group = {
      groupId: 'another-group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
    };

    await testGroupStore.putGroup('another-group-id', 'test-user', group);

    const response = await approveDenyHandler(
      'another-group-id',
      'to-be-added-user',
      'approve',
      'wrong-user',
      ['analyst'],
      accessRequest,
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      message: 'User does not have permission to grant access request',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });

  it('should return bad request if an invalid action is supplied', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'to-be-added-user',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
    };
    await testGroupStore.putGroup('group-id', 'test-user', group);
    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id', userId: 'to-be-added-user' },
      'to-be-added-user',
      accessRequest,
    );

    const response = await approveDenyHandler(
      'group-id',
      'to-be-added-user',
      'action-does-not-exist', // invalid action
      'test-user',
      ['analyst', 'group-id'],
      accessRequest,
    );
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message:
        'Path does not exist. Error actioning an accessRequest with groupId group-id and userId to-be-added-user',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });

  it('should return not found if group does not exist', async () => {
    const accessRequest = {
      groupId: 'group-id-does-not-exist',
      userId: 'to-be-added-user',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };
    const response = await approveDenyHandler(
      'group-id-does-not-exist',
      'to-be-added-user',
      'approve',
      'test-user',
      ['analyst'],
      accessRequest,
    );
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Not Found: no group was found with group-id-does-not-exist',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });

  it('should not be able to add a member that already exists in the group', async () => {
    const accessRequest = {
      groupId: 'another-group-id',
      userId: 'member-already-exists',
      reason: 'APPROVE',
      ...createUpdateDetails,
    };

    const group = {
      groupId: 'another-group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-already-exists'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      ...groupCreateUpdateDetails,
    };

    await testGroupStore.putGroup('another-group-id', 'test-user', group);
    await testAccessRequestStore.putAccessRequest(
      { groupId: 'another-group-id', userId: 'member-already-exists' },
      'access-requester',
      accessRequest,
    );

    const response = await approveDenyHandler(
      'another-group-id',
      'member-already-exists',
      'approve',
      'test-user',
      ['admin'],
      accessRequest,
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: `User already exists in group ${group.groupId}`,
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });
});
