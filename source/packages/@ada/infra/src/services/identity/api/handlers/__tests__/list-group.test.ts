/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { Group } from '@ada/api';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-group';

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('list-group', () => {
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
  const listGroupsHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putGeneratedGroup = (groupId: string) =>
    testGroupStore.putGroup(groupId, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });
  it('should list groups', async () => {
    let response = await listGroupsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).groups).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    response = await listGroupsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).groups.map((o: Group) => o.groupId)).toIncludeSameMembers([
      'list-groups-test-1',
      'list-groups-test-2',
      'list-groups-test-3',
      'list-groups-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should list groups with a limit', async () => {
    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    let response = await listGroupsHandler({ limit: '3' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).groups).toHaveLength(3);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    response = await listGroupsHandler({ limit: '9999' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).groups).toHaveLength(4);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should list groups with pagination', async () => {
    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    let response = await listGroupsHandler({ pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.groups).toHaveLength(3);

    response = await listGroupsHandler({ pageSize: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body);
    expect(secondPage.groups).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect([...firstPage.groups, ...secondPage.groups].map((o: Group) => o.groupId)).toIncludeSameMembers([
      'list-groups-test-1',
      'list-groups-test-2',
      'list-groups-test-3',
      'list-groups-test-4',
    ]);
  });

  it('should list groups with pagination and a limit', async () => {
    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    let response = await listGroupsHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.groups).toHaveLength(2);

    response = await listGroupsHandler({ pageSize: '2', limit: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body);
    expect(secondPage.groups).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    let response = await listGroupsHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.groups).toHaveLength(2);

    // Limit in the second request should be ignored
    response = await listGroupsHandler({ pageSize: '2', limit: '9999', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    // We should honour the original limit and return our one remaining group
    const secondPage = JSON.parse(response.body);
    expect(secondPage.groups).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should list groups with a limit smaller than page size', async () => {
    await Promise.all([
      putGeneratedGroup('list-groups-test-1'),
      putGeneratedGroup('list-groups-test-2'),
      putGeneratedGroup('list-groups-test-3'),
      putGeneratedGroup('list-groups-test-4'),
    ]);

    const response = await listGroupsHandler({ pageSize: '4', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.groups).toHaveLength(3);
  });

  it('should return 400 when given an invalid nextToken', async () => {
    const response = await listGroupsHandler({ nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    const response = await listGroupsHandler({ limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    const response = await listGroupsHandler({ pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });
});
