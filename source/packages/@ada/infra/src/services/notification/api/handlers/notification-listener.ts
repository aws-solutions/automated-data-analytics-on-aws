/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DefaultUser, EventBridgeEvent } from '@ada/microservice-common';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { NotificationStore } from '../../components/ddb/notification-store';
import { persistedNotificationFromEvent } from '../../../api/components/notification/common';

const log = Logger.getLogger({ tags: ['PersistNotifications'] });

/**
 * Handler for listening to notifications and persisting them in dynamodb
 */
export const handler = async (event: EventBridgeEvent<any>, _context: any) => {
  const notification = persistedNotificationFromEvent(event);
  if (notification) {
    const persistedNotification = await NotificationStore.getInstance().putNotification(
      {
        notificationId: notification.notificationId,
        target: notification.target,
      },
      DefaultUser.SYSTEM,
      notification,
    );

    log.info('Persisted notification', persistedNotification);
  } else {
    log.info('Notification had no target and was not persisted', event);
  }
};
