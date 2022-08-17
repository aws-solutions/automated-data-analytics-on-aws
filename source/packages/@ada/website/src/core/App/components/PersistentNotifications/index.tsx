/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { NotificationButton, NotificationButtonProps } from '$northstar-plus';
import { usePersistedNotifications } from './use-persistent-notifications';
import React from 'react';

export const PersistentNotifications: React.FC<NotificationButtonProps> = ({
  dismissAllThreshold,
  dismissAll = true,
}) => {
  usePersistedNotifications();

  return <NotificationButton dismissAll={dismissAll} dismissAllThreshold={dismissAllThreshold} />;
};
