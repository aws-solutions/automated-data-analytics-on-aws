/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { NotificationStore } from '../../components/ddb/notification-store';
import type { PersistedNotificationStatusEnum } from '@ada/api';

/**
 * Handler for listing notifications. Only notifications for the calling user are returned.
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listNotifications', async ({ requestParameters }, { userId }) => {
  const { status } = requestParameters;
  const paginationParameters = getPaginationParameters(requestParameters);

  const store = NotificationStore.getInstance();

  // List notifications where the calling user has been targeted. When a status is provided, list only those
  // of the given status
  const response = status
    ? await store.listNotificationsForStatus(userId, status as PersistedNotificationStatusEnum, paginationParameters)
    : await store.listNotifications(userId, paginationParameters);

  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
