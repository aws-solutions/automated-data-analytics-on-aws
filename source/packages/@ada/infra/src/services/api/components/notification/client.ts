/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsEventBridgeInstance, EventBridge } from '@ada/aws-sdk';
import { VError } from 'verror';
import { buildEventDetail, buildSource } from './common';
import type { Notification } from '@ada/api';

// Environment variable is made available by the cdk construct
export const NOTIFICATION_BUS_ARN_ENV = 'NOTIFICATION_BUS_EVENT_BUS_ARN';

export interface INotificationClient {
  send: (...notifications: Notification[]) => Promise<void>;
}

/**
 * Client for sending notifications
 */
export class NotificationClient implements INotificationClient {
  private static instance: NotificationClient | undefined;

  /* istanbul ignore next */
  public static getInstance = (): INotificationClient => {
    if (!NotificationClient.instance) {
      NotificationClient.instance = new NotificationClient(AwsEventBridgeInstance());
    }
    return NotificationClient.instance;
  };

  private readonly eventBridge: EventBridge;

  private constructor(eventBridge: EventBridge) {
    if (!process.env[NOTIFICATION_BUS_ARN_ENV]) {
      throw new VError(
        { name: 'NotificationBusConfigError' },
        'Usage error: notification bus environment has not been configured.',
      );
    }
    this.eventBridge = eventBridge;
  }

  /**
   * Send the given notifications
   * @param notifications the notifications to send
   */
  public async send(...notifications: Notification[]) {
    await this.eventBridge
      .putEvents({
        Entries: notifications.map((notification) => ({
          EventBusName: process.env[NOTIFICATION_BUS_ARN_ENV]!,
          Source: buildSource(notification.source),
          DetailType: notification.type,
          Detail: buildEventDetail(notification.payload, notification.target),
        })),
      })
      .promise();
  }
}
