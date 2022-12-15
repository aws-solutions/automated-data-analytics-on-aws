/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { AccessRequestNotificationType, DataProductEventDetailTypes } from '@ada/common';
import { DataProduct, PersistedNotificationEntity } from '@ada/api';
import { ENV_PRODUCTION, featureFlag } from '$config';
import { LL } from '@ada/strings';
import { Notification, NotificationInput, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { getDataProductSQLIdentitier, identifierToName } from '$common/utils';
import { getDataProductUrl } from '$common/entity/data-product/utils';
import { getGroupUrl } from '$common/entity/group';
import { isEmpty, startCase } from 'lodash';
import { useHistory } from 'react-router';
import React, { useCallback, useEffect, useState } from 'react';

/* eslint-disable sonarjs/cognitive-complexity */

const POLLING_INTERVAL = featureFlag('NOTIFICATIONS_POLLING') ? POLLING.NOTIFICATIONS : false;

type NotificationTypes = DataProductEventDetailTypes | AccessRequestNotificationType;

export function usePersistedNotifications() { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  const { addNotifications, dismissNotification } = useNotificationContext();
  const history = useHistory();

  const [acknowledgeNotification] = apiHooks.usePutNotificationAction();

  const onDismiss = useCallback((id: string) => {
    acknowledgeNotification({ notificationId: id, persistedNotificationStatus: { status: 'ACKNOWLEDGED' } });
  }, []);

  const [pollResponse] = apiHooks.useNotifications(
    { status: 'PENDING' },
    {
      refetchInterval: POLLING_INTERVAL, // TODO: set appropriate interval to poll for notifications
      staleTime: POLLING_INTERVAL ? POLLING_INTERVAL - 1 : undefined,
    },
  );
  const notifications = pollResponse?.notifications;

  const [, setTracked] = useState<string[]>([]);
  useEffect(() => {
    if (notifications && notifications.length) {
      setTracked((tracked) => {
        const untracked: NotificationInput[] = [];
        notifications.forEach((n) => {
          if (tracked.includes(n.notificationId) === false) {
            tracked.push(n.notificationId);
            const input = marshalNotification(n, onDismiss, dismissNotification, history);
            if (input) {
              untracked.push(input);
            }
          }
        });
        untracked.length && setTimeout(() => addNotifications(untracked), 0);
        return tracked;
      });
    }
  }, [JSON.stringify(notifications)]);
}

function marshalNotification( //NOSONAR (S3776:Cognitive Complexity) - won't fix
  persisted: PersistedNotificationEntity,
  onDismiss: (id: string) => void,
  dismissNotification: (id: string) => void, //NOSONAR (S1172:Unused Function Parameter) - retain
  history: ReturnType<typeof useHistory>,
): NotificationInput | null {
  const { notificationId: id, createdTimestamp: timestamp, type } = persisted;
  const payload = persisted.payload as any;

  const onClickFactory = (url: string) => (event: any) => {
    if (!isDismissButtonEvent(event)) {
      history.push(url);
    }
  };

  try {
    const notification: NotificationInput = {
      id,
      timestamp: Date.parse(timestamp!),
      variant: 'default', // default will show in header icon
      type: marshalType(type),
      header: startCase(type),
      content: marshalDefaultContent(payload),
      dismissible: true,
      onDismiss: () => onDismiss(id),
    };

    switch (persisted.type as NotificationTypes) {
      case DataProductEventDetailTypes.DATA_PRODUCT_BUILD_ERROR:
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR:
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_START_FAILED:
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS:
      case DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE: {
        // some events come through with payload as partial data product, others with nested dataProduct property
        const dataProduct: DataProduct = payload.dataProduct || payload;
        const url = getDataProductUrl(dataProduct);

        return Object.assign(notification, {
          content: `${dataProduct.name || identifierToName(dataProduct.dataProductId)} - ${getDataProductSQLIdentitier(dataProduct)}`,
          onClick: onClickFactory(url),
        } as Partial<NotificationInput>);
      }
      case AccessRequestNotificationType.REQUEST:
      case AccessRequestNotificationType.APPROVE:
      case AccessRequestNotificationType.DENY: {
        const groupId = payload.accessRequest.groupId;
        const url = getGroupUrl(groupId);

        return Object.assign(notification, {
          header: LL.ENTITY.AccessRequest_.notify.header(groupId),
          content: payload.reason || payload.accessRequest.message,
          onClick: onClickFactory(url),
        } as Partial<NotificationInput>);
      }
      default: {
        if (!ENV_PRODUCTION) {
          return {
            ...notification,
            header: `[DEV]Unsupported: ${type}`,
          } as NotificationInput;
        } else {
          // ignore notification
          return null;
        }
      }
    }
  } catch (error: any) {
    console.error('Failed to marshall persistent notification:', persisted, error);

    return null;
  }
}

function marshalType(type: string): Notification['type'] {
  if (/(error|fail|deny|reject)/i.test(type)) return 'error';
  if (/(success|approve)/i.test(type)) return 'success';
  return 'info';
}

function marshalDefaultContent(payload: any): string | undefined { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  try {
    if (payload.message && !isEmpty(payload.message)) return payload.message;
    if (payload.reason && !isEmpty(payload.reason)) return payload.reason;

    if (payload.errorDetails) {
      if (typeof payload.errorDetails.Cause === 'string') {
        try {
          const errorMessage = JSON.parse(payload.errorDetails.Cause).errorMessage;
          if (errorMessage) {
            return errorMessage;
          }
        } catch (e: any) {
          return payload.errorDetails.Cause;
        }
      }
      if (typeof payload.errorDetails.Error === 'string') {
        return payload.errorDetails.Error;
      }
    }
  } catch (error) {
    console.warn('Failed to parse notification payload', payload, error);
  }

  return undefined;
}

function isDismissButtonEvent(event: React.MouseEvent<HTMLElement>): boolean {
  return ('closest' in event.target && (event.target as HTMLElement).closest('button[aria-label="Close"]')) != null;
}
