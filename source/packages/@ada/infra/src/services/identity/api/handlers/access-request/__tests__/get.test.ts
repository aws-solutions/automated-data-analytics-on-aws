/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AccessRequest } from '@ada/api-client';
import { AccessRequestStore } from '../../../../../api/components/ddb/access-request';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get';
import { jest } from '@jest/globals';

jest.mock('@ada/api-client-lambda');

const testAccessRequestStore: AccessRequestStore = new (AccessRequestStore as any)(getLocalDynamoDocumentClient());
AccessRequestStore.getInstance = jest.fn(() => testAccessRequestStore);

describe('get-access-request', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const getAccessRequestHandler = (
    groupId: string,
    userId: string,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { groupId, userId },
      }) as any,
      null,
    );

  it.each(['group-owner', DefaultGroupIds.ADMIN, 'subject', 'requester'])(
    'should return an access request when the user is %s',
    async (caller) => {
      const accessRequest = {
        groupId: 'group-id',
        userId: 'subject',
        message: 'give me access please',
      } as AccessRequest;

      await testAccessRequestStore.putAccessRequest(
        { groupId: 'group-id', userId: 'subject' },
        'requester',
        accessRequest,
      );

      API.getIdentityGroup.mockResolvedValue({
        groupId: 'group-id',
        createdBy: 'group-owner',
      });

      const response = await getAccessRequestHandler('group-id', 'subject', {
        ...DEFAULT_CALLER,
        userId: caller,
        groups: [caller],
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(
        expect.objectContaining({
          ...accessRequest,
        }),
      );
    },
  );

  it('should return 404 if the access request does not exist', async () => {
    const response = await getAccessRequestHandler('fake-id', 'fake-id');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('fake-id');
  });

  it('should return 404 if the user does not have access to the access request', async () => {
    const accessRequest = {
      groupId: 'group-id',
      userId: 'subject',
      message: 'give me access please',
    } as AccessRequest;

    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id', userId: 'subject' },
      'requester',
      accessRequest,
    );

    API.getIdentityGroup.mockResolvedValue({
      groupId: 'group-id',
      createdBy: 'group-owner',
    });

    const response = await getAccessRequestHandler('group-id', 'subject', {
      ...DEFAULT_CALLER,
      userId: 'not-permitted-user',
      groups: [],
    });

    expect(response.statusCode).toBe(404);
  });
});
