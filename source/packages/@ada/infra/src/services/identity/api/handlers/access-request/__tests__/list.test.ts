/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AccessRequest } from '@ada/api-client';
import { AccessRequestStore, ListAccessRequestResponse } from '../../../../../api/components/ddb/access-request';
import { CallingUser } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../list';

jest.mock('@ada/api-client-lambda');

const testAccessRequestStore = new (AccessRequestStore as any)(getLocalDynamoDocumentClient());
AccessRequestStore.getInstance = jest.fn(() => testAccessRequestStore);

describe('list-access-request', () => {
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
  const listAccessRequestHandler = (
    queryStringParameters?: { [key: string]: string },
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        queryStringParameters,
      }) as any,
      null,
    );

  const generateAccessRequest = (groupId: string) =>
    testAccessRequestStore.putAccessRequest({ groupId, userId: 'test-user' }, 'test-user', {
      message: 'test-access-request',
    });

  it('should list all available AccessRequests without limit', async () => {
    let response = await listAccessRequestHandler();
    let body = JSON.parse(response.body) as ListAccessRequestResponse;

    expect(response.statusCode).toBe(200);
    expect(body.accessRequests).toBeArrayOfSize(0);
    expect(body).not.toHaveProperty('nextToken');

    await Promise.all([
      generateAccessRequest('group-id-1'),
      generateAccessRequest('group-id-2'),
      generateAccessRequest('group-id-3'),
      generateAccessRequest('group-id-4'),
    ]);

    response = await listAccessRequestHandler();
    body = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(response.statusCode).toBe(200);
    expect(body.accessRequests).toBeArrayOfSize(4);
    expect(body.accessRequests.map((o: AccessRequest) => o.groupId)).toIncludeSameMembers([
      'group-id-1',
      'group-id-2',
      'group-id-3',
      'group-id-4',
    ]);

    expect(body).not.toHaveProperty('nextToken');
  });

  it('should list AccessRequest when limit parameter is provided', async () => {
    await Promise.all([
      generateAccessRequest('group-id-1'),
      generateAccessRequest('group-id-2'),
      generateAccessRequest('group-id-3'),
      generateAccessRequest('group-id-4'),
    ]);

    let response = await listAccessRequestHandler({ limit: '3' });
    let body = JSON.parse(response.body) as ListAccessRequestResponse;

    expect(response.statusCode).toBe(200);
    expect(body.accessRequests).toBeArrayOfSize(3);
    expect(body).not.toHaveProperty('nextToken');

    response = await listAccessRequestHandler({ limit: '5' });
    body = JSON.parse(response.body) as ListAccessRequestResponse;

    expect(response.statusCode).toBe(200);
    expect(body.accessRequests).toBeArrayOfSize(4);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should paginate AccessRequest based on parameters', async () => {
    await Promise.all([
      generateAccessRequest('group-id-1'),
      generateAccessRequest('group-id-2'),
      generateAccessRequest('group-id-3'),
      generateAccessRequest('group-id-4'),
    ]);

    let response = await listAccessRequestHandler({ pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(firstPage.accessRequests).toBeArrayOfSize(3);

    response = await listAccessRequestHandler({ pageSize: '3', nextToken: firstPage.nextToken! });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(secondPage.accessRequests).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect(
      [...firstPage.accessRequests, ...secondPage.accessRequests].map((o: AccessRequest) => o.groupId),
    ).toIncludeSameMembers(['group-id-1', 'group-id-2', 'group-id-3', 'group-id-4']);
  });

  it('should paginate AccessRequest based on parameters when limit is applied', async () => {
    await Promise.all([
      generateAccessRequest('group-id-1'),
      generateAccessRequest('group-id-2'),
      generateAccessRequest('group-id-3'),
      generateAccessRequest('group-id-4'),
    ]);

    let response = await listAccessRequestHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(firstPage.accessRequests).toBeArrayOfSize(2);

    response = await listAccessRequestHandler({ pageSize: '2', limit: '3', nextToken: firstPage.nextToken! });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(secondPage.accessRequests).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await Promise.all([
      generateAccessRequest('group-id-1'),
      generateAccessRequest('group-id-2'),
      generateAccessRequest('group-id-3'),
      generateAccessRequest('group-id-4'),
    ]);

    let response = await listAccessRequestHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(firstPage.accessRequests).toBeArrayOfSize(2);

    // Limit in the second request should be ignored
    response = await listAccessRequestHandler({ pageSize: '2', limit: '9999', nextToken: firstPage.nextToken! });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(secondPage.accessRequests).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should return 400 when given an invalid nextToken', async () => {
    const response = await listAccessRequestHandler({ nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    const response = await listAccessRequestHandler({ limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    const response = await listAccessRequestHandler({ pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should list access requests for owned groups when the caller is not admin', async () => {
    const nonAdminCaller: CallingUser = {
      ...DEFAULT_CALLER,
      userId: 'non-admin',
      groups: [],
    };

    await Promise.all([
      generateAccessRequest('owned-1'),
      generateAccessRequest('owned-2'),
      generateAccessRequest('not-owned-1'),
      generateAccessRequest('not-owned-2'),
    ]);

    API.listIdentityGroups.mockResolvedValue({
      groups: [
        { groupId: 'owned-1', createdBy: nonAdminCaller.userId },
        { groupId: 'not-owned-1', createdBy: 'darthvader' },
        { groupId: 'owned-2', createdBy: nonAdminCaller.userId },
        { groupId: 'not-owned-2', createdBy: 'lukeskywalker' },
      ],
    });

    const response = await listAccessRequestHandler({}, nonAdminCaller);

    expect(response.statusCode).toBe(200);
    const listedRequests = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(listedRequests.accessRequests).toBeArrayOfSize(2);
    expect(listedRequests.accessRequests.map(({ groupId }) => groupId)).toIncludeSameMembers(['owned-1', 'owned-2']);
    expect(listedRequests.nextToken).toBeUndefined();
  });

  it('should follow pages of owned groups', async () => {
    const nonAdminCaller: CallingUser = {
      ...DEFAULT_CALLER,
      userId: 'non-admin',
      groups: [],
    };

    await Promise.all([
      generateAccessRequest('owned-1'),
      generateAccessRequest('owned-2'),
      generateAccessRequest('not-owned-1'),
      generateAccessRequest('not-owned-2'),
    ]);

    API.listIdentityGroups
      .mockResolvedValueOnce({
        groups: [
          { groupId: 'owned-1', createdBy: nonAdminCaller.userId },
          { groupId: 'not-owned-1', createdBy: 'darthvader' },
        ],
        nextToken: 'more',
      })
      .mockResolvedValueOnce({
        groups: [
          { groupId: 'owned-2', createdBy: nonAdminCaller.userId },
          { groupId: 'not-owned-2', createdBy: 'lukeskywalker' },
        ],
      });

    const response = await listAccessRequestHandler({}, nonAdminCaller);

    expect(response.statusCode).toBe(200);
    const listedRequests = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(listedRequests.accessRequests).toBeArrayOfSize(2);
    expect(listedRequests.accessRequests.map(({ groupId }) => groupId)).toIncludeSameMembers(['owned-1', 'owned-2']);
    expect(listedRequests.nextToken).toBeUndefined();
  });

  it('should list access requests where the caller is the subject', async () => {
    const subjectCaller: CallingUser = {
      ...DEFAULT_CALLER,
      userId: 'subject',
      groups: [],
    };

    await Promise.all([
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'subject' }, 'requester', {
        message: 'test',
      }),
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'other-subject' }, 'requester', {
        message: 'test',
      }),
    ]);

    API.listIdentityGroups.mockResolvedValue({
      groups: [
        { groupId: 'owned-1', createdBy: subjectCaller.userId },
        { groupId: 'not-owned-1', createdBy: 'darthvader' },
      ],
    });

    const response = await listAccessRequestHandler({}, subjectCaller);

    expect(response.statusCode).toBe(200);
    const listedRequests = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(listedRequests.accessRequests).toBeArrayOfSize(1);
    expect(listedRequests.accessRequests[0]).toEqual(
      expect.objectContaining({
        groupId: 'some-unowned-group',
        userId: 'subject',
        message: 'test',
        createdBy: 'requester',
      }),
    );
    expect(listedRequests.nextToken).toBeUndefined();
  });

  it('should list access requests where the caller is the requester', async () => {
    const requesterCaller: CallingUser = {
      ...DEFAULT_CALLER,
      userId: 'requester',
      groups: [],
    };

    await Promise.all([
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'subject' }, 'not-requester', {
        message: 'test',
      }),
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'other-subject' }, 'requester', {
        message: 'test',
      }),
    ]);

    API.listIdentityGroups.mockResolvedValue({
      groups: [
        { groupId: 'owned-1', createdBy: requesterCaller.userId },
        { groupId: 'not-owned-1', createdBy: 'darthvader' },
      ],
    });

    const response = await listAccessRequestHandler({}, requesterCaller);

    expect(response.statusCode).toBe(200);
    const listedRequests = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(listedRequests.accessRequests).toBeArrayOfSize(1);
    expect(listedRequests.accessRequests[0]).toEqual(
      expect.objectContaining({
        groupId: 'some-unowned-group',
        userId: 'other-subject',
        message: 'test',
        createdBy: 'requester',
      }),
    );
    expect(listedRequests.nextToken).toBeUndefined();
  });

  it('should list access requests when the user owns no groups', async () => {
    const requesterCaller: CallingUser = {
      ...DEFAULT_CALLER,
      userId: 'requester',
      groups: [],
    };

    await Promise.all([
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'subject' }, 'not-requester', {
        message: 'test',
      }),
      testAccessRequestStore.putAccessRequest({ groupId: 'some-unowned-group', userId: 'other-subject' }, 'requester', {
        message: 'test',
      }),
    ]);

    API.listIdentityGroups.mockResolvedValue({
      groups: [
        { groupId: 'not-owned-1', createdBy: 'lukeskywalker' },
        { groupId: 'not-owned-2', createdBy: 'darthvader' },
      ],
    });

    const response = await listAccessRequestHandler({}, requesterCaller);

    expect(response.statusCode).toBe(200);
    const listedRequests = JSON.parse(response.body) as ListAccessRequestResponse;
    expect(listedRequests.accessRequests).toBeArrayOfSize(1);
    expect(listedRequests.accessRequests[0]).toEqual(
      expect.objectContaining({
        groupId: 'some-unowned-group',
        userId: 'other-subject',
        message: 'test',
        createdBy: 'requester',
      }),
    );
    expect(listedRequests.nextToken).toBeUndefined();
  });
});
