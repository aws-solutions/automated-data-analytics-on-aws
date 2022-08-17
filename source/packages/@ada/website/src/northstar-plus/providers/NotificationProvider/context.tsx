/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_TEST } from '$config';
import {
  FatalNotificationInput,
  ManagedNotification,
  NotificationInput,
  NotificationVariant,
  OnAddedNotification,
  OnDismissedNotification,
  TypedNotificationInput,
  VarientNotificationInput,
} from './types';
import { createContext, useContext } from 'react';

export interface ManagedNotificationStore {
  /** All "default" notifications. */
  allNotifications: ManagedNotification[];
  /** All "default" notifications. */
  defaultNotifications: ManagedNotification[];
  /** All "flashbar" notifications. */
  flashbarNotifications: ManagedNotification[];
  /** All "brief" notifications. */
  briefNotifications: ManagedNotification[];
}

export const DEFAULT_NOTIFICATION_STORE: ManagedNotificationStore = {
  allNotifications: [],
  defaultNotifications: [],
  flashbarNotifications: [],
  briefNotifications: [],
};

export interface NotificationContext extends ManagedNotificationStore {
  /**
   * Add a notification.
   * @returns id
   */
  addNotification: (notification: NotificationInput) => string;
  addNotifications: (notifications: NotificationInput[]) => void;

  addFatal: (notification: FatalNotificationInput) => string;
  addError: (notification: TypedNotificationInput) => string;
  addWarning: (notification: TypedNotificationInput) => string;
  addInfo: (notification: TypedNotificationInput) => string;
  addSuccess: (notification: TypedNotificationInput) => string;

  /** Add a "flashbar" notification. */
  addFlashbar: (notification: VarientNotificationInput) => string;
  /** Add a "brief" notification. */
  addBrief: (notification: VarientNotificationInput) => string;

  /**
   * Dismiss the specified notification.
   */
  dismissNotification: (id: string) => void;
  /**
   * Dismiss all notification.
   */
  dismissAllNotifications: (variant?: NotificationVariant) => void;

  onAddedNotification: OnAddedNotification;
  onDismissedNotification: OnDismissedNotification;
}

const DEFAULT_FN = (...args: any[]): any => {
  !ENV_TEST && console.warn('Wrap with NotificationProvider to enable notificaiton support.', ...args);
};

export const DEFAULT_NOTIFICATION_CONTEXT: NotificationContext = {
  ...DEFAULT_NOTIFICATION_STORE,

  addNotification: DEFAULT_FN,
  addFatal: DEFAULT_FN,
  addError: DEFAULT_FN,
  addWarning: DEFAULT_FN,
  addInfo: DEFAULT_FN,
  addSuccess: DEFAULT_FN,

  addNotifications: DEFAULT_FN,
  addFlashbar: DEFAULT_FN,
  addBrief: DEFAULT_FN,
  dismissNotification: DEFAULT_FN,
  dismissAllNotifications: DEFAULT_FN,

  onAddedNotification: DEFAULT_FN,
  onDismissedNotification: DEFAULT_FN,
};

export const NotificationContext = createContext<NotificationContext>(DEFAULT_NOTIFICATION_CONTEXT); //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context == null) throw new Error('Must wrap with NoticiationContext.Provider');
  return context;
};

export const useNotifications = (variant?: NotificationVariant) => {
  const context = useNotificationContext();
  switch (variant) {
    case 'default':
      return context.defaultNotifications;
    case 'flashbar':
      return context.flashbarNotifications;
    case 'brief':
      return context.briefNotifications;
    default:
      return context.allNotifications;
  }
};

export const useDefaultNotifications = () => {
  return useNotifications('default');
};

export const useFlashbarNotifications = () => {
  return useNotifications('flashbar');
};

export const useBriefNotifications = () => {
  return useNotifications('brief');
};
