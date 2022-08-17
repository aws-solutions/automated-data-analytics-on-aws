/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EventBridgeEvent } from '@ada/infra-common/services';
import { PersistedNotificationStatusEnum } from '@ada/api';
import type { PersistedNotification } from '@ada/api';

export const EVENT_SOURCE_PREFIX = 'ada';

export const METADATA_DETAIL_KEY = '__ada_metadata';

/**
 * Possible Sources for events
 */
export enum EventSource {
  DATA_PRODUCTS = 'data-products',
  IDENTITY = 'identity',
}

/**
 * Create the event bridge event source from a given notification source
 */
export const buildSource = (source: string): string => `${EVENT_SOURCE_PREFIX}.${source}`;

const buildEventDetailMetadataObject = (target?: string | string[]): Record<string, unknown> | undefined =>
  target
    ? {
        [METADATA_DETAIL_KEY]: {
          target,
        },
      }
    : undefined;

/**
 * Create the event bridge event detail to send
 * @param payload arbitrary event payload
 * @param target the recipient of the event, if any
 */
export const buildEventDetailObject = (payload?: any, target?: string | string[]): { [key: string]: any } | undefined =>
  payload || target
    ? {
        ...payload,
        ...buildEventDetailMetadataObject(target),
      }
    : undefined;

/**
 * Create the event bridge event detail to send as a json string
 * @param payload arbitrary event payload
 * @param target the recipient of the event, if any
 */
export const buildEventDetail = (payload?: any, target?: string | string[]): string | undefined => {
  const detail = buildEventDetailObject(payload, target);
  return detail ? JSON.stringify(detail) : undefined;
};

export const buildTargetAndStatusKey = (target: string, status: PersistedNotificationStatusEnum): string =>
  `${target}.${status}`;

/**
 * Build a notification from an eventbridge event
 * @param event
 */
export const persistedNotificationFromEvent = (event: EventBridgeEvent<any>): PersistedNotification | undefined => {
  const { [METADATA_DETAIL_KEY]: metadata, ...payload } = event.detail || {};
  const { target } = metadata || {};
  // When there's no target, we don't persist the notification
  if (!target) {
    return undefined;
  }
  const status: PersistedNotificationStatusEnum = 'PENDING';

  return {
    notificationId: event.id,
    source: event.source.replace(`${EVENT_SOURCE_PREFIX}.`, ''),
    type: event['detail-type'],
    payload: payload || {},
    target,
    status,
    targetAndStatus: buildTargetAndStatusKey(target, status),
  };
};
