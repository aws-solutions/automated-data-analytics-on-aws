/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestAction, AccessRequestNotificationType, DefaultGroupIds, ROOT_ADMIN_ID } from '@ada/common';
import { PersistedNotificationEntity } from '@ada/api';
import { TEST_USER } from '$common/entity/user';

export const NOTIFICATION_ACCESS_REQUEST_APPROVE: PersistedNotificationEntity = {
  createdBy: 'system',
  createdTimestamp: '2022-03-11T08:32:43.959Z',
  notificationId: 'mock-NOTIFICATION_ACCESS_REQUEST_APPROVE',
  payload: {
    reason: 'mock reason',
    action: AccessRequestAction.APPROVE,
    caller: ROOT_ADMIN_ID,
    accessRequest: {
      updatedBy: TEST_USER.id,
      createdBy: TEST_USER.id,
      groupId: DefaultGroupIds.DEFAULT,
      createdTimestamp: '2022-03-11T08:27:15.289Z',
      message: 'mock message',
      updatedTimestamp: '2022-03-11T08:27:15.289Z',
      userId: TEST_USER.id,
    },
    timestamp: '2022-03-11T08:32:42.970Z',
  },
  source: 'identity',
  status: 'PENDING',
  target: TEST_USER.id,
  targetAndStatus: `${TEST_USER.id}.PENDING`,
  type: AccessRequestNotificationType.APPROVE,
  updatedBy: 'system',
  updatedTimestamp: '2022-03-11T08:32:43.959Z',
};

export const NOTIFICATION_ACCESS_REQUEST_DENY: PersistedNotificationEntity = {
  createdBy: 'system',
  createdTimestamp: '2022-03-11T08:32:43.959Z',
  notificationId: 'mock-NOTIFICATION_ACCESS_REQUEST_DENY',
  payload: {
    reason: 'mock reason',
    action: AccessRequestAction.DENY,
    caller: ROOT_ADMIN_ID,
    accessRequest: {
      updatedBy: TEST_USER.id,
      createdBy: TEST_USER.id,
      groupId: DefaultGroupIds.POWER_USER,
      createdTimestamp: '2022-03-11T08:27:15.289Z',
      message: 'mock message',
      updatedTimestamp: '2022-03-11T08:27:15.289Z',
      userId: TEST_USER.id,
    },
    timestamp: '2022-03-11T08:32:42.970Z',
  },
  source: 'identity',
  status: 'PENDING',
  target: TEST_USER.id,
  targetAndStatus: `${TEST_USER.id}.PENDING`,
  type: AccessRequestNotificationType.DENY,
  updatedBy: 'system',
  updatedTimestamp: '2022-03-11T08:32:43.959Z',
};

export const NOTIFICATION_ACCESS_REQUEST: PersistedNotificationEntity = {
  createdBy: 'system',
  createdTimestamp: '2022-03-11T08:32:43.959Z',
  notificationId: 'mock-NOTIFICATION_ACCESS_REQUEST',
  payload: {
    caller: ROOT_ADMIN_ID,
    accessRequest: {
      updatedBy: TEST_USER.id,
      createdBy: TEST_USER.id,
      groupId: DefaultGroupIds.ADMIN,
      createdTimestamp: '2022-03-11T08:27:15.289Z',
      message: 'mock message',
      updatedTimestamp: '2022-03-11T08:27:15.289Z',
      userId: TEST_USER.id,
    },
    timestamp: '2022-03-11T08:32:42.970Z',
  },
  source: 'identity',
  status: 'PENDING',
  target: TEST_USER.id,
  targetAndStatus: `${TEST_USER.id}.PENDING`,
  type: AccessRequestNotificationType.REQUEST,
  updatedBy: 'system',
  updatedTimestamp: '2022-03-11T08:32:43.959Z',
};

export const NOTIFICATIONS = [
  NOTIFICATION_ACCESS_REQUEST_APPROVE,
  NOTIFICATION_ACCESS_REQUEST_DENY,
  NOTIFICATION_ACCESS_REQUEST,
];
