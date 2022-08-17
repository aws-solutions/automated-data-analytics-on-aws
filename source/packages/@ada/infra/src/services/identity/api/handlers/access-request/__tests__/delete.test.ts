/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AccessRequest } from '@ada/api-client';
import { AccessRequestStore } from '../../../../../api/components/ddb/access-request';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { GroupStore } from '../../../../../api/components/ddb/groups';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../delete';

const testAccessRequestStore: AccessRequestStore = new (AccessRequestStore as any)(getLocalDynamoDocumentClient());
AccessRequestStore.getInstance = jest.fn(() => testAccessRequestStore);
const testGroupStore: GroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('delete-access-request', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    await testGroupStore.putGroup('group-id-1', 'group-creator', {
      apiAccessPolicyIds: [],
      claims: [],
      groupId: 'group-id-1',
      members: [],
    });
    await testGroupStore.putGroup('group-id-2', 'group-creator', {
      apiAccessPolicyIds: [],
      claims: [],
      groupId: 'group-id-2',
      members: [],
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const deleteAccessRequestHandler = (
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

  it.each(['group-creator', 'subject', 'request-creator', DefaultGroupIds.ADMIN])(
    'should delete an access request when the caller %s',
    async (callingUserId) => {
      const accessRequest = {
        message: 'a test accessRequest',
      } as AccessRequest;

      await testAccessRequestStore.putAccessRequest(
        { groupId: 'group-id-1', userId: 'subject' },
        'request-creator',
        accessRequest,
      );
      await testAccessRequestStore.putAccessRequest(
        { groupId: 'group-id-2', userId: 'subject' },
        'request-creator',
        accessRequest,
      );

      const expectedaccessRequest = {
        ...accessRequest,
        groupId: 'group-id-1',
        userId: 'subject',
        createdBy: 'request-creator',
        updatedBy: 'request-creator',
        createdTimestamp: now,
        updatedTimestamp: now,
      };

      const response = await deleteAccessRequestHandler('group-id-1', 'subject', {
        ...DEFAULT_CALLER,
        groups: [callingUserId],
        userId: callingUserId,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(expectedaccessRequest);

      expect(await testAccessRequestStore.getAccessRequest('group-id-1', 'subject')).toBe(undefined);
      expect(await testAccessRequestStore.getAccessRequest('group-id-2', 'subject')).not.toBe(undefined);
    },
  );

  it('should return 404 if ids dont exist', async () => {
    const response = await deleteAccessRequestHandler('group-id-does-not-exist', 'test-user-not-exist');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('group-id-does-not-exist');
  });

  it('should return 403 if the user is not the subject, request creator, group creator or admin', async () => {
    const accessRequest = {
      message: 'a test accessRequest',
    } as AccessRequest;
    await testAccessRequestStore.putAccessRequest(
      { groupId: 'group-id-1', userId: 'subject' },
      'request-creator',
      accessRequest,
    );
    const response = await deleteAccessRequestHandler('group-id-1', 'subject', {
      ...DEFAULT_CALLER,
      groups: ['analyst'],
      userId: 'some-unauthorized-user',
    });

    expect(response.statusCode).toBe(403);
  });
});
