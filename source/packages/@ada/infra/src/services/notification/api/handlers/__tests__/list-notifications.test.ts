/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { DefaultUser } from '@ada/microservice-common';
import { NotificationStore } from '../../../components/ddb/notification-store';
import { PersistedNotificationStatusEnum } from '@ada/api-client';
import { buildApiRequest } from '@ada/api-gateway';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-notifications';

// Mock the Notification Store to point to our local dynamodb
const testNotificationStore = new (NotificationStore as any)(getLocalDynamoDocumentClient());
NotificationStore.getInstance = jest.fn(() => testNotificationStore);

describe('list-notifications', () => {
  const putNotification = (target: string, notificationId: string, status: PersistedNotificationStatusEnum) =>
    testNotificationStore.putNotification(
      {
        target,
        notificationId,
      },
      DefaultUser.SYSTEM,
      {
        notificationId,
        payload: { some: 'payload' },
        source: 'some-source',
        status,
        target,
        targetAndStatus: `${target}.${status}`,
        type: 'test-type',
      },
    );

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();

    await Promise.all([
      putNotification('darthvader', 'n1', 'PENDING'),
      putNotification('darthvader', 'n2', 'ACKNOWLEDGED'),
      putNotification('darthvader', 'n3', 'PENDING'),
      putNotification('darthvader', 'n4', 'ACKNOWLEDGED'),
      putNotification('lukeskywalker', 'n5', 'PENDING'),
      putNotification('lukeskywalker', 'n6', 'ACKNOWLEDGED'),
    ]);
  });

  const listNotifications = (userId: string, status?: PersistedNotificationStatusEnum) =>
    handler(
      buildApiRequest(
        {
          userId,
          username: `${userId}@usr.example.com`,
          groups: [],
        },
        {
          queryStringParameters: {
            status: status as string,
          },
        },
      ) as any,
      null,
    );

  it('should list the calling users notifications', async () => {
    const response = await listNotifications('darthvader');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).notifications.map((n: any) => n.notificationId)).toIncludeSameMembers([
      'n1',
      'n2',
      'n3',
      'n4',
    ]);
  });

  it('should list the calling users notifications with status', async () => {
    const response = await listNotifications('darthvader', 'PENDING');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).notifications.map((n: any) => n.notificationId)).toIncludeSameMembers([
      'n1',
      'n3',
    ]);
  });

  it('should return bad requests for errors', async () => {
    testNotificationStore.listNotificationsForStatus = jest.fn().mockReturnValue({ error: 'bad notifications' });
    const response = await listNotifications('darthvader', 'PENDING');
    expect(testNotificationStore.listNotificationsForStatus).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({ name: 'Error', message: 'bad notifications', errorId: expect.stringMatching(/\w{10}/) });
  });
});
