/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { NotificationStore } from '../../components/ddb/notification-store';
import { buildTargetAndStatusKey } from '../../../api/components/notification/common';

/**
 * Handler for actioning a notification
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putNotificationAction',
  async ({ requestParameters, body: { status } }, { userId }) => {
    const { notificationId } = requestParameters;

    const store = NotificationStore.getInstance();
    const notificationIdentifier = { target: userId, notificationId };

    const notification = await store.getNotification(notificationIdentifier);

    if (!notification) {
      return ApiResponse.notFound({ message: `Could not find a notification for ${userId} with id ${notificationId}` });
    }

    return ApiResponse.success(
      await store.putNotification(notificationIdentifier, userId, {
        ...notification,
        status,
        targetAndStatus: buildTargetAndStatusKey(notificationIdentifier.target, status),
      }),
    );
  },
);
