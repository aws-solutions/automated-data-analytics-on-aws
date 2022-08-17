/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { DefaultUser } from '@ada/microservice-common';
import { NotificationStore } from '../../../components/ddb/notification-store';
import { PersistedNotificationStatusEnum } from '@ada/api-client';
import { buildApiRequest } from '@ada/api-gateway';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../action-notification';

// Mock the Notification Store to point to our local dynamodb
const testNotificationStore = new (NotificationStore as any)(getLocalDynamoDocumentClient());
NotificationStore.getInstance = jest.fn(() => testNotificationStore);

describe('action-notification', () => {
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

  const actionNotification = (userId: string, notificationId: string, status: PersistedNotificationStatusEnum) =>
    handler(
      buildApiRequest(
        {
          userId,
          username: `${userId}@usr.example.com`,
          groups: [],
        },
        {
          pathParameters: {
            notificationId,
          },
          body: {
            status,
          },
        },
      ) as any,
      null,
    );

  it('should action a notification', async () => {
    const response = await actionNotification('darthvader', 'n1', 'ACKNOWLEDGED');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        notificationId: 'n1',
        status: 'ACKNOWLEDGED',
        targetAndStatus: 'darthvader.ACKNOWLEDGED',
      }),
    );

    expect(await testNotificationStore.getNotification({ target: 'darthvader', notificationId: 'n1' })).toEqual(
      expect.objectContaining({
        notificationId: 'n1',
        status: 'ACKNOWLEDGED',
        targetAndStatus: 'darthvader.ACKNOWLEDGED',
      }),
    );
  });

  it('should return 404 when the notification does not exist', async () => {
    let response = await actionNotification('darthvader', 'missing-notification', 'ACKNOWLEDGED');
    expect(response.statusCode).toBe(404);
    // Luke trying to acknowledge Darth Vader's notification
    response = await actionNotification('lukeskywalker', 'n1', 'ACKNOWLEDGED');
    expect(response.statusCode).toBe(404);
  });
});
