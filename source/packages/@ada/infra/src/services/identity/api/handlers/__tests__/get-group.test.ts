/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-group';

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('get-group', () => {
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
  const getGroupHandler = (groupId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { groupId },
      }),
      null,
    );

  it('should return a group if the groupId exists', async () => {
    const group = {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    };
    // Create our new group
    await testGroupStore.putGroup('get-group-id', 'test-user', group);

    const expectedGroup = {
      ...group,
      groupId: 'get-group-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await getGroupHandler('get-group-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedGroup);
  });

  it('should return 404 if groupId does not exist', async () => {
    const response = await getGroupHandler('group-id-does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('group-id-does-not-exist');
  });
});
