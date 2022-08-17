/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AccessRequest } from '@ada/api-client';
import { AccessRequestNotificationType, CallingUser, DefaultGroupIds, ROOT_ADMIN_ID } from '@ada/common';
import { AccessRequestStore } from '../../../../../api/components/ddb/access-request';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { DefaultUser } from '@ada/microservice-common';
import { GroupStore } from '../../../../../api/components/ddb/groups';
import { INotificationClient, NotificationClient } from '../../../../../api/components/notification/client';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put';
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

describe('put-access-request', () => {
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
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.clearAllMocks();

    await testGroupStore.putGroup('group-id', 'group-owner', {
      apiAccessPolicyIds: [],
      claims: [],
      groupId: 'group-id',
      members: [],
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putAccessRequestHandler = (
    groupId: string,
    userId: string,
    accessRequest: Omit<AccessRequest, 'groupId' | 'userId'>,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { groupId, userId },
        body: accessRequest,
      }) as any,
      null,
    );

  it.each(['subject', 'request-creator', DefaultGroupIds.ADMIN])(
    'should create and update access requests for caller %s',
    async (updatingUserId) => {
      const accessRequest = {
        groupId: 'group-id',
        userId: 'subject',
        message: 'approved',
      } as AccessRequest;

      const response = await putAccessRequestHandler('group-id', 'subject', accessRequest, {
        ...DEFAULT_CALLER,
        userId: 'request-creator',
        groups: ['analyst'],
      });

      expect(response.statusCode).toBe(200);

      const expectedAccessRequest = {
        ...accessRequest,
        ...createUpdateDetails,
        createdBy: 'request-creator',
        updatedBy: 'request-creator',
        groupId: 'group-id',
        userId: 'subject',
      };

      expect(JSON.parse(response.body)).toEqual(expectedAccessRequest);

      // Check the access request is written to dynamodb
      expect(await testAccessRequestStore.getAccessRequest('group-id', 'subject')).toEqual(expectedAccessRequest);

      expect(mockNotificationClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'group-owner',
          type: AccessRequestNotificationType.REQUEST,
        }),
      );

      const updatedAccessRequest = {
        groupId: 'group-id',
        userId: 'subject',
        message: 'denied',
        updatedTimestamp: createUpdateDetails.updatedTimestamp,
      } as AccessRequest;

      const updatedResponse = await putAccessRequestHandler('group-id', 'subject', updatedAccessRequest, {
        ...DEFAULT_CALLER,
        userId: updatingUserId,
        groups: [updatingUserId],
      });
      const expectedUpdatedAcessRequest = {
        ...updatedAccessRequest,
        ...createUpdateDetails,
        updatedBy: updatingUserId,
        createdBy: 'request-creator',
        groupId: 'group-id',
      };

      expect(updatedResponse.statusCode).toBe(200);
      expect(JSON.parse(updatedResponse.body)).toEqual(expectedUpdatedAcessRequest);
      expect(await testAccessRequestStore.getAccessRequest('group-id', 'subject')).toEqual({
        ...expectedUpdatedAcessRequest,
      });
    },
  );

  it('should NOT create the access request if item with same id exists', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    const response = await putAccessRequestHandler('group-id', 'test-user', accessRequest);

    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...accessRequest,
      ...createUpdateDetails,
      groupId: 'group-id',
      userId: 'test-user',
    };

    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    // Check the access request is written to dynamodb
    expect(await testAccessRequestStore.getAccessRequest('group-id', 'test-user')).toEqual(expectedGroup);

    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'group-owner',
        type: AccessRequestNotificationType.REQUEST,
      }),
    );

    const updatedAccessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    const updatedResponse = await putAccessRequestHandler('group-id', 'test-user', updatedAccessRequest);

    expect(updatedResponse.statusCode).toBe(400);
    expect(JSON.parse(updatedResponse.body)?.message).toContain('Item with same id already exists');
  });

  it('should NOT update the access request if updatedTimestamp does not match', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    const response = await putAccessRequestHandler('group-id', 'test-user', accessRequest);

    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...accessRequest,
      ...createUpdateDetails,
      groupId: 'group-id',
      userId: 'test-user',
    };

    expect(JSON.parse(response.body)).toEqual(expectedGroup);

    // Check the access request is written to dynamodb
    expect(await testAccessRequestStore.getAccessRequest('group-id', 'test-user')).toEqual(expectedGroup);

    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'group-owner',
        type: AccessRequestNotificationType.REQUEST,
      }),
    );

    const updatedAccessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
      updatedTimestamp: before,
    } as AccessRequest;

    const updatedResponse = await putAccessRequestHandler('group-id', 'test-user', updatedAccessRequest);

    expect(updatedResponse.statusCode).toBe(400);
    expect(JSON.parse(updatedResponse.body)?.message).toContain('cannot be updated');
  });

  it('should create an access request with a urlencoded userId', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    const response = await putAccessRequestHandler('group-id', 'test-user%40amazon.com', accessRequest);

    expect(response.statusCode).toBe(200);

    const expectedGroup = {
      ...accessRequest,
      ...createUpdateDetails,
      groupId: 'group-id',
      userId: 'test-user@amazon.com',
    };
    expect(await testAccessRequestStore.getAccessRequest('group-id', 'test-user@amazon.com')).toEqual(expectedGroup);
  });

  it('should return not found if groupId does not exist', async () => {
    const accessRequest = {
      groupId: 'group-id-does-not-exist',
      userId: 'test-user',
      message: 'approved',
      updatedTimestamp: before,
    } as AccessRequest;

    const updatedResponse = await putAccessRequestHandler('group-id-does-not-exist', 'test-user', accessRequest);

    expect(updatedResponse.statusCode).toBe(404);
    expect(JSON.parse(updatedResponse.body)?.message).toContain(
      'The group with groupId group-id-does-not-exist does not exist.',
    );
  });

  it('should notify the group owner of an access request', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    const response = await putAccessRequestHandler('group-id', 'test-user', accessRequest);
    expect(response.statusCode).toBe(200);

    expect(mocked(mockNotificationClient).send.mock.calls[0]).toIncludeSameMembers([
      expect.objectContaining({
        target: 'group-owner',
        type: AccessRequestNotificationType.REQUEST,
      }),
    ]);
  });

  it('should not allow a user to update an access request that they did not create or where they are not the subject', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'subject',
      message: 'approved',
    } as AccessRequest;

    const response = await putAccessRequestHandler('group-id', 'subject', accessRequest, {
      ...DEFAULT_CALLER,
      userId: 'request-creator',
      groups: ['analyst'],
    });

    expect(response.statusCode).toBe(200);

    const updateResponse = await putAccessRequestHandler('group-id', 'subject', accessRequest, {
      ...DEFAULT_CALLER,
      userId: 'unauthorized-user',
      groups: ['analyst'],
    });

    expect(updateResponse.statusCode).toBe(403);
  });

  // TODO: Enable if necessary in the future
  it.skip('should notify members of the admin group and the root admin for requests to system created groups', async () => {
    const accessRequest = {
      groupId: 'system-owned-group',
      userId: 'test-user',
      message: 'approved',
    } as AccessRequest;

    await testGroupStore.putGroup('system-owned-group', DefaultUser.SYSTEM, {
      apiAccessPolicyIds: [],
      claims: [],
      groupId: 'system-owned-group',
      members: [],
    });
    await testGroupStore.putGroup(DefaultGroupIds.ADMIN, DefaultUser.SYSTEM, {
      apiAccessPolicyIds: [],
      claims: [],
      groupId: DefaultGroupIds.ADMIN,
      members: ['admin-user'],
    });

    const response = await putAccessRequestHandler('system-owned-group', 'test-user', accessRequest);
    expect(response.statusCode).toBe(200);

    expect(mocked(mockNotificationClient).send.mock.calls[0]).toIncludeSameMembers([
      expect.objectContaining({
        target: 'admin-user',
        type: AccessRequestNotificationType.REQUEST,
      }),
      expect.objectContaining({
        target: ROOT_ADMIN_ID,
        type: AccessRequestNotificationType.REQUEST,
      }),
    ]);
  });
});
