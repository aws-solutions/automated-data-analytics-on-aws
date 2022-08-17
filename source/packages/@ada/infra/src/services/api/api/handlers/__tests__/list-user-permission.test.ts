/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { GroupStore } from '../../../components/ddb/groups';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../list-user-permission';

const adminGetUserMock = jest.fn();
const getResourcesMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    adminGetUser: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(adminGetUserMock(...args))),
    }),
  })),
  AwsAPIGatewayInstance: jest.fn().mockImplementation(() => ({
    getResources: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(getResourcesMock(...args))),
    }),
  })),
}));

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

// Mock the api access policy to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('list-user-permission', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const listUserPermissionHandler = (
    userId: string = DEFAULT_CALLER.userId,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { userId },
      }) as any,
      null,
    );

  const generateGroup = (groupId: string, apiAccessPolicyIds: string[]) =>
    testGroupStore.putGroup(groupId, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    });

  const generateGeneratedApiAccessPolicy = (apiAccessPolicyId: string, resources: string[]) =>
    testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', {
      name: 'test name',
      description: 'test description',
      resources,
    });

  it('should return 403 if the request come from a different user that is not admin', async () => {
    const response = await listUserPermissionHandler(DEFAULT_CALLER.userId, {
      groups: [DefaultGroupIds.DEFAULT],
      userId: 'another-user',
      username: 'another-user@usr.example.com',
    });
    expect(response.statusCode).toBe(403);
  });

  it('should return 400 if the user was not found', async () => {
    adminGetUserMock.mockImplementation(() => {
      throw new Error('not found');
    });

    const response = await listUserPermissionHandler();
    expect(response.statusCode).toBe(400);
  });

  it('should return the right permissions based on the user policies', async () => {
    getResourcesMock.mockReturnValue({
      items: [
        {
          path: '/query/{executionId}/result-as-athena',
          resourceMethods: { GET: {}, OPTIONS: {} },
        },
        {
          path: '/identity/provider/{identityProviderId}',
          resourceMethods: { DELETE: {}, GET: {}, OPTIONS: {}, PUT: {} },
        },
        {
          path: '/identity/group/{groupId}/members',
          resourceMethods: { OPTIONS: {}, PUT: {} },
        },
      ],
    });
    adminGetUserMock.mockReturnValue({
      UserAttributes: [
        {
          Name: 'custom:groups',
          Value: 'group1,group2',
        },
      ],
    });
    await generateGroup('group1', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', [
      'arn:aws:execute-api:ap-southeast-2:123456789012:xxxxxxxxxx/*/GET/*',
    ]);

    const response = await listUserPermissionHandler();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).permissions).toEqual({
      GetQueryResultAsAthena: {
        access: true,
      },
      DeleteIdentityProvider: {
        access: false,
      },
      GetIdentityProvider: {
        access: true,
      },
      PutIdentityProvider: {
        access: false,
      },
      PutIdentityGroupMembers: {
        access: false,
      },
    });
  });
});
