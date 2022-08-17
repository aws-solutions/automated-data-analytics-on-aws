/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { EventBridgeEvent } from '@ada/microservice-common';
import { NotificationStore } from '../../../components/ddb/notification-store';
import { buildEventDetailObject, buildSource } from '../../../../api/components/notification/common';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../notification-listener';

// Mock the Notification Store to point to our local dynamodb
const testNotificationStore = new (NotificationStore as any)(getLocalDynamoDocumentClient());
NotificationStore.getInstance = jest.fn(() => testNotificationStore);

describe('notification-listener', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const createUpdateDetails = {
    createdBy: 'system',
    updatedBy: 'system',
    createdTimestamp: now,
    updatedTimestamp: now,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const event = (extra: Partial<EventBridgeEvent<any>>): EventBridgeEvent<any> => ({
    'detail-type': 'test-type',
    account: 'account',
    detail: undefined,
    id: 'id',
    region: 'region',
    source: buildSource(extra.source || 'test'),
    time: 'time',
    version: 'version',
    ...extra,
  });

  it('should save a targetted notification in dynamodb', async () => {
    await handler(
      event({
        detail: buildEventDetailObject({ some: 'payload' }, 'target-user'),
      }),
      null,
    );

    expect(await testNotificationStore.getNotification({ target: 'target-user', notificationId: 'id' })).toEqual({
      ...createUpdateDetails,
      notificationId: 'id',
      source: 'test',
      type: 'test-type',
      payload: { some: 'payload' },
      target: 'target-user',
      status: 'PENDING',
      targetAndStatus: 'target-user.PENDING',
    });
  });

  it('should not save a notification without a target', async () => {
    await handler(event({}), null);

    expect((await testNotificationStore.listAllNotifications({})).notifications).toHaveLength(0);
  });
});
