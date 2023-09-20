/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DEFAULT_NOTIFICATION_STORE, ManagedNotificationStore, NotificationContext } from './context';
import {
  ManagedNotification,
  Notification,
  NotificationEmitter,
  NotificationInput,
  NotificationPriority,
} from './types';
import { nanoid } from 'nanoid';
import { sortBy } from 'lodash';
import { useImmer } from 'use-immer';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

const generateId = () => nanoid(10);

const DEFAULT_AUTO_DIMSISS_DURATION = 7500;

export interface NotificationPriorityMapper {
  (notification: NotificationInput): number;
}

const DEFAULT_PRIORITY_MAPPER: NotificationPriorityMapper = (notification) => {
  if (notification.priority != null) return notification.priority;
  switch (notification.type) {
    case 'error':
      return NotificationPriority.HIGH;
    case 'warning':
      return NotificationPriority.MEDIUM;
    case 'info':
      return NotificationPriority.LOW;
    case 'success':
      return NotificationPriority.LOW;
  }
};

export interface NotificationDefaults extends Pick<Required<NotificationInput>, 'variant' | 'dismissible'> {
  priority: Notification['priority'] | NotificationPriorityMapper;
}

const NOTIFICATION_DEFAULTS: NotificationDefaults = {
  variant: 'default',
  dismissible: true,
  priority: DEFAULT_PRIORITY_MAPPER,
};

export interface NotificationProviderProps {
  /** Default duration for "auto" dismiss. */
  autoDismissDuration?: number;

  notificationDefaults?: Partial<NotificationDefaults>;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  notificationDefaults: notificationDefaultsProp,
  autoDismissDuration = DEFAULT_AUTO_DIMSISS_DURATION,
}) => {
  const emitter = useMemo(() => {
    return new NotificationEmitter();
  }, []);
  const [store, updateStore] = useImmer<ManagedNotificationStore>(DEFAULT_NOTIFICATION_STORE);
  const defaults = useMemo<NotificationDefaults>(() => {
    return {
      ...NOTIFICATION_DEFAULTS,
      ...notificationDefaultsProp,
    };
  }, [JSON.stringify(notificationDefaultsProp)]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoDismissTimeoutsRef = useRef<[string, any][]>([]);
  // clean up auto dismiss timeouts on unmount
  useEffect(() => {
    return () => {
      autoDismissTimeoutsRef.current.forEach(([, timeout]) => clearTimeout(timeout));
    };
  }, []);

  const dismissNotification = useCallback(
    (id: string) => {
      updateStore((draft) => {
        const notificationIndex: number = draft.allNotifications.findIndex((v) => v.id === id);
        if (notificationIndex === -1) {
          console.error(`NotificationProvider:dismissNotification:: not found ${id}`);
          return;
        }
        const notification: ManagedNotification = draft.allNotifications[notificationIndex];
        notification.originalOnDismiss && notification.originalOnDismiss();

        // remove notification in place
        draft.allNotifications.splice(notificationIndex, 1);
        switch (notification.variant) {
          case 'default': {
            const index = draft.defaultNotifications.findIndex((v) => v.id === id);
            index !== -1 && draft.defaultNotifications.splice(index, 1);
            break;
          }
          case 'flashbar': {
            const index = draft.flashbarNotifications.findIndex((v) => v.id === id);
            index !== -1 && draft.flashbarNotifications.splice(index, 1);
            break;
          }
          case 'brief': {
            const index = draft.briefNotifications.findIndex((v) => v.id === id);
            index !== -1 && draft.briefNotifications.splice(index, 1);
            break;
          }
        }

        emitter.emit('DISMISSED', notification);
      });
    },
    [updateStore],
  );

  const dismissAllNotifications = useCallback<NotificationContext['dismissAllNotifications']>(
    (variant) => {
      updateStore((draft) => {
        const _store: ManagedNotificationStore = DEFAULT_NOTIFICATION_STORE;

        draft.allNotifications.forEach((notification) => {
          if (variant == null || notification.variant === variant) {
            notification.originalOnDismiss && notification.originalOnDismiss();

            emitter.emit('DISMISSED', notification);
          } else {
            _store.allNotifications.push(notification);
            switch (notification.variant) {
              case 'default': {
                _store.defaultNotifications.push(notification);
                break;
              }
              case 'flashbar': {
                _store.flashbarNotifications.push(notification);
                break;
              }
              case 'brief': {
                _store.briefNotifications.push(notification);
                break;
              }
            }
          }
        });

        return _store;
      });
    },
    [updateStore, emitter],
  );

  const addNotification = useCallback(
    (_input: NotificationInput): string => {
      const input: Omit<NotificationInput, 'priority'> &
        Omit<NotificationDefaults, 'priority'> &
        Pick<Notification, 'priority'> = {
        ...defaults,
        ..._input,
        priority: marshalPriority(_input, defaults),
      };
      const id = input.id || generateId();
      let dismissible = input.dismissible;
      const onDismiss = () => {
        dismissNotification(id);
        try {
          const autoDismissIndex = autoDismissTimeoutsRef.current.findIndex((tuple) => tuple[0] === id);
          if (autoDismissIndex !== -1) autoDismissTimeoutsRef.current.splice(autoDismissIndex, 1);
        } catch (error) {
          console.warn('Failed to remove notification from auto dismiss:', error);
        }
      };
      if (typeof dismissible === 'number' || dismissible === 'auto') {
        autoDismissTimeoutsRef.current.push([
          id,
          setTimeout(onDismiss, getAutoDismissDuration(dismissible, autoDismissDuration)),
        ]);
        dismissible = true;
      }
      const notification: ManagedNotification = {
        ...input,
        id,
        timestamp: input.timestamp || Date.now(),
        priority: input.priority,
        dismissible: dismissible !== false,
        originalOnDismiss: input.onDismiss,
        onDismiss,
      };

      updateStore((draft) => {
        // ignore duplicate notifications
        if (draft.allNotifications.find((n) => n.id === id)) return;

        draft.allNotifications = sortBy(draft.allNotifications.concat([notification]), ['priority', 'timestamp']);
        switch (notification.variant) {
          case 'default': {
            draft.defaultNotifications = sortBy(draft.defaultNotifications.concat([notification]), [
              'priority',
              'timestamp',
            ]);
            break;
          }
          case 'flashbar': {
            draft.flashbarNotifications = sortBy(draft.flashbarNotifications.concat([notification]), [
              'priority',
              'timestamp',
            ]);
            break;
          }
          case 'brief': {
            draft.briefNotifications = sortBy(draft.briefNotifications.concat([notification]), [
              'priority',
              'timestamp',
            ]);
            break;
          }
        }
      });

      emitter.emit('ADDED', notification);
      return id;
    },
    [dismissNotification, updateStore, defaults, autoDismissDuration, emitter],
  );

  const addFatal = useCallback<NotificationContext['addFatal']>(
    (notification) => {
      return addNotification({
        type: 'error',
        priority: NotificationPriority.EVEREST,
        variant: 'flashbar',
        ...notification,
        dismissible: false,
        onDismiss: undefined,
      });
    },
    [addNotification],
  );
  const addError = useCallback<NotificationContext['addError']>(
    (notification) => {
      return addNotification({
        type: 'error',
        variant: 'flashbar',
        ...notification,
      });
    },
    [addNotification],
  );
  const addWarning = useCallback<NotificationContext['addWarning']>(
    (notification) => {
      return addNotification({
        type: 'warning',
        variant: 'flashbar',
        ...notification,
      });
    },
    [addNotification],
  );
  const addInfo = useCallback<NotificationContext['addInfo']>(
    (notification) => {
      return addNotification({
        type: 'info',
        variant: 'flashbar',
        ...notification,
      });
    },
    [addNotification],
  );
  const addSuccess = useCallback<NotificationContext['addSuccess']>(
    ({ dismissible, ...notification }) => {
      return addNotification({
        dismissible: dismissible || 'auto',
        type: 'success',
        variant: 'flashbar',
        ...notification,
      });
    },
    [addNotification],
  );

  const addNotifications = useCallback<NotificationContext['addNotifications']>(
    (notifications) => {
      notifications.forEach((notification) => addNotification(notification));
    },
    [addNotification],
  );

  const addFlashbar = useCallback<NotificationContext['addFlashbar']>(
    (notification) => {
      return addNotification({
        ...notification,
        variant: 'flashbar',
        elementOptions: {
          autoHideDuration: getAutoDismissDuration(
            notification.elementOptions?.autoHideDuration || notification.dismissible,
            autoDismissDuration,
          ),
        },
      });
    },
    [addNotification, autoDismissDuration],
  );

  const addBrief = useCallback<NotificationContext['addBrief']>(
    (notification) => {
      return addNotification({
        ...notification,
        dismissible: true,
        variant: 'brief',
        elementOptions: {
          autoHideDuration: getAutoDismissDuration(
            notification.elementOptions?.autoHideDuration || notification.dismissible,
            autoDismissDuration,
          ),
        },
      });
    },
    [addNotification, autoDismissDuration],
  );

  const onAddedNotification = useCallback<NotificationContext['onAddedNotification']>(
    (listener) => {
      emitter.on('ADDED', listener);
      return () => emitter.off('ADDED', listener);
    },
    [emitter],
  );

  const onDismissedNotification = useCallback<NotificationContext['onDismissedNotification']>(
    (listener) => {
      emitter.on('DISMISSED', listener);
      return () => emitter.off('DISMISSED', listener);
    },
    [emitter],
  );

  const context: NotificationContext = useMemo(() => ({
    ...store,
    addNotification,
    addFatal,
    addError,
    addWarning,
    addInfo,
    addSuccess,
    addNotifications,
    dismissNotification,
    dismissAllNotifications,
    addFlashbar,
    addBrief,
    onAddedNotification,
    onDismissedNotification,
  }), [
    store, addNotification, 
    addFatal, addError, addWarning, addInfo, addSuccess,
    addNotifications, dismissNotification, dismissAllNotifications,
    addFlashbar, addBrief, onAddedNotification, onDismissedNotification,
  ]);

  return <NotificationContext.Provider value={context}>{children}</NotificationContext.Provider>;
};

function marshalPriority(input: NotificationInput, defaults: NotificationDefaults): number {
  if (input.priority != null) return input.priority;
  if (typeof defaults.priority === 'function') return defaults.priority(input);
  if (typeof defaults.priority === 'number') return defaults.priority;
  return NotificationPriority.MEDIUM;
}

function getAutoDismissDuration(dismissible: NotificationInput['dismissible'], defaultDuration: number): number {
  if (typeof dismissible === 'number') {
    return dismissible;
  }

  return defaultDuration;
}
