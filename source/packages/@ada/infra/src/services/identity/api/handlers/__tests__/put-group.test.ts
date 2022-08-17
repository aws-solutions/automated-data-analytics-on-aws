/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import * as _ from 'lodash';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { DefaultUser } from '@ada/microservice-common';
import { Group } from '@ada/api';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-group';

jest.mock('@ada/api-client-lambda');

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('put-group', () => {
  const before = '2020-01-01T00:00:00.000Z';
  const now = '2021-01-01T00:00:00.000Z';
  const createUpdateDetails = {
    createdBy: 'test-user',
    updatedBy: 'test-user',
    createdTimestamp: now,
    updatedTimestamp: now,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    API.getApiAccessPolicy.mockResolvedValue({});
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putGroupHandler = (
    groupId: string,
    group: Omit<Group, 'groupId'>,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { groupId },
        body: group,
      }) as any,
      null,
    );

  it('should create and update groups', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group);
    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...group,
      groupId: 'group-id',
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toEqual(expectedGroup);

    // Check the claim mappings are correct
    expect(await Promise.all([testGroupStore.getClaim('claim-1'), testGroupStore.getClaim('claim-2')])).toEqual([
      { groupIds: ['group-id'] },
      { groupIds: ['group-id'] },
    ]);

    expect(API.getApiAccessPolicy).toHaveBeenCalledTimes(3);
    apiAccessPolicyIds.forEach((apiAccessPolicyId) =>
      expect(API.getApiAccessPolicy).toHaveBeenCalledWith({ apiAccessPolicyId }),
    );

    const updatedGroup = {
      ...group,
      updatedTimestamp: createUpdateDetails.updatedTimestamp,
      description: 'new description',
      claims: ['claim-1', 'claim-3'],
    };

    // Update the group, adding and removing some claims
    // Create our new group
    const updateResponse = await putGroupHandler('group-id', updatedGroup);
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedGroup = {
      ...updatedGroup,
      ...createUpdateDetails,
    };
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedGroup);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toEqual(expectedUpdatedGroup);

    // Check the claim mappings are correct
    expect(await Promise.all([testGroupStore.getClaim('claim-1'), testGroupStore.getClaim('claim-3')])).toEqual([
      { groupIds: ['group-id'] },
      { groupIds: ['group-id'] },
    ]);
    expect(await testGroupStore.getClaim('claim-2')).toBeUndefined();
  });

  it('should not create the group if the request contains apiAccessPolicyIds that do not belong to calling user groups', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: [...apiAccessPolicyIds, 'super-admin'],
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group, {
      ...DEFAULT_CALLER,
      groups: ['analyst'],
    });
    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.body)).toEqual({
      message:
        'Error assigning the requested API Access Polices to the new group. The following policies are not allowed: super-admin',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });

    // Check the group is not written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toBeUndefined();
    expect(API.getApiAccessPolicy).toHaveBeenCalledTimes(4);
    expect(API.getIdentityGroup).toHaveBeenCalledTimes(1);
    apiAccessPolicyIds.forEach((apiAccessPolicyId) =>
      expect(API.getApiAccessPolicy).toHaveBeenCalledWith({ apiAccessPolicyId }),
    );
    expect(API.getIdentityGroup).toHaveBeenNthCalledWith(1, { groupId: 'analyst' });
  });

  it('should create the group if the request contains apiAccessPolicyIds that do not belong to calling user groups when the user is an admin', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: [...apiAccessPolicyIds, 'super-admin'],
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group, {
      ...DEFAULT_CALLER,
      groups: ['admin'],
    });
    expect(response.statusCode).toBe(200);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toBeDefined();
  });

  it('should create and update groups that have no members to begin with', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: [],
      apiAccessPolicyIds,
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group);
    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...group,
      groupId: 'group-id',
      members: [],
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toEqual(expectedGroup);
  });

  it('should Not create the group if same groupId exists', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group);
    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...group,
      groupId: 'group-id',
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toEqual(expectedGroup);

    // Check the claim mappings are correct
    expect(await Promise.all([testGroupStore.getClaim('claim-1'), testGroupStore.getClaim('claim-2')])).toEqual([
      { groupIds: ['group-id'] },
      { groupIds: ['group-id'] },
    ]);

    expect(API.getApiAccessPolicy).toHaveBeenCalledTimes(3);
    apiAccessPolicyIds.forEach((apiAccessPolicyId) =>
      expect(API.getApiAccessPolicy).toHaveBeenCalledWith({ apiAccessPolicyId }),
    );

    const duplicateGroup = {
      ...group,
      description: 'new description',
    };

    // Update the group, adding and removing some claims
    // Create our new group
    const updateResponse = await putGroupHandler('group-id', duplicateGroup);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('Item with same id already exists');
  });

  it('should Not update the group if updateTimestamp does not match', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group);
    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...group,
      groupId: 'group-id',
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id')).toEqual(expectedGroup);

    // Check the claim mappings are correct
    expect(await Promise.all([testGroupStore.getClaim('claim-1'), testGroupStore.getClaim('claim-2')])).toEqual([
      { groupIds: ['group-id'] },
      { groupIds: ['group-id'] },
    ]);

    expect(API.getApiAccessPolicy).toHaveBeenCalledTimes(3);
    apiAccessPolicyIds.forEach((apiAccessPolicyId) =>
      expect(API.getApiAccessPolicy).toHaveBeenCalledWith({ apiAccessPolicyId }),
    );

    const updatedGroup = {
      ...group,
      updatedTimestamp: before,
      description: 'new description',
      claims: ['claim-1', 'claim-3'],
    };

    // Update the group, adding and removing some claims
    // Create our new group
    const updateResponse = await putGroupHandler('group-id', updatedGroup);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('cannot be updated');
  });

  it('should not check for the existence of api access policies when called by the system user', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    const response = await putGroupHandler('group-id', group, { ...DEFAULT_CALLER, userId: DefaultUser.SYSTEM });
    expect(response.statusCode).toBe(200);

    expect(API.getApiAccessPolicy).not.toHaveBeenCalled();
    expect(API.getIdentityGroup).not.toHaveBeenCalled();
  });

  it('should create a group with more than 25 claims', async () => {
    const apiAccessPolicyIds = _.range(100).map((n) => `accessPolicyId-${n}`);
    const group = {
      name: 'test name',
      description: 'test description',
      claims: _.range(100).map((n) => `over-25-claims-test-claim-${n}`),
      members: _.range(100).map((n) => `over-25-members-test-claim-${n}`),
      apiAccessPolicyIds,
    };
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    // Create our new group
    const response = await putGroupHandler('over-25-claims-test-group-id', group);

    expect(response.statusCode).toBe(200);
  });

  it('should map claims to multiple groups', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });

    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    const groupTwo = {
      groupId: 'group-id-two',
      description: 'Another group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };

    // Create our new group
    const response = await putGroupHandler('group-id', group);
    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...group,
      groupId: 'group-id',
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    const responseTwo = await putGroupHandler('group-id-two', groupTwo);
    expect(responseTwo.statusCode).toBe(200);

    const expectedGroupTwo = {
      ...groupTwo,
      groupId: 'group-id-two',
      ...createUpdateDetails,
    };
    expect(JSON.parse(responseTwo.body)).toEqual(expectedGroupTwo);

    // Check the group is written to dynamodb
    expect(await testGroupStore.getGroup('group-id-two')).toEqual(expectedGroupTwo);

    // Check the claim mappings are correct
    expect(await Promise.all([testGroupStore.getClaim('claim-1'), testGroupStore.getClaim('claim-2')])).toEqual([
      { groupIds: ['group-id', 'group-id-two'] },
      { groupIds: ['group-id', 'group-id-two'] },
    ]);
  });

  it('should not update an existing group if the user is not the group owner or admin', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };
    await testGroupStore.putGroup('group-id', 'creator', group);

    // Create our new group
    const response = await putGroupHandler('group-id', group, {
      ...DEFAULT_CALLER,
      userId: 'not-the-creator',
      groups: ['analyst'],
    });
    expect(response.statusCode).toBe(403);
  });

  it('should update an existing group if the user is the group owner', async () => {
    const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
    API.getIdentityGroup.mockResolvedValue({
      apiAccessPolicyIds,
    });
    const group = {
      groupId: 'group-id',
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    };
    const writtenGroup = await testGroupStore.putGroup('group-id', 'creator', group);

    // Create our new group
    const response = await putGroupHandler('group-id', writtenGroup, {
      ...DEFAULT_CALLER,
      userId: 'creator',
      groups: ['analyst'],
    });
    expect(response.statusCode).toBe(200);
  });
});
