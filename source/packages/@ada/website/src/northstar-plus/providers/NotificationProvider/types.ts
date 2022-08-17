/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Optional } from '$ts-utils';
import { SnackbarProps } from '@material-ui/core';
import EventEmitter from 'eventemitter3';
import React from 'react';

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export type NotificationVariant = 'default' | 'flashbar' | 'brief';

export type BriefOptions = Pick<SnackbarProps, 'autoHideDuration'>;

export enum NotificationPriority {
  LOW = 0,
  MEDIUM = 0.5,
  HIGH = 0.8,
  EVEREST = 1,
}

export interface Notification {
  id: string;
  timestamp: number;

  /** Indicates the type of the message to be displayed. Allowed values: success, error, warning, info (default: "info"). */
  type: NotificationType;

  variant: NotificationVariant;

  /**
   * Indicates the priorit of the notification; used for sorting to ensure priority messages are displayed first.
   * Range between 0 - 1, with 1 being considered highest (everest) priority.
   * @see {NotificationPriority}
   * @default {NotificationPriority.MEDIUM} 0.5
   */
  priority: number;

  /** Heading text. */
  header: string;
  /** Primary text displayed in the element. */
  content?: string;
  /** Replaces the status icon with a spinner and forces the type of alert to info. */
  loading?: boolean;

  /** When set, a normal action button is displayed with the specified text. **/
  buttonText?: string;
  /** The event fired when a user clicks on the close icon that is displayed when the dismissible property is set to true. */
  onDismiss?: () => void;
  /** The event fired when a user clicks on the action button. */
  onButtonClick?: () => void;

  dismissible: boolean;

  onClick?: (event: React.MouseEvent<HTMLElement>) => void;

  /**
   * Additional options based on type of notification.
   * For non-peristent (Snackbar) notifications these are `SnackbarProps`.
   */
  elementOptions?: BriefOptions;
}

export interface ManagedNotification extends Notification {
  originalOnDismiss?: Notification['onDismiss'];
}

export interface NotificationInput
  extends Omit<Optional<Notification, 'id' | 'timestamp' | 'variant' | 'priority'>, 'dismissible'> {
  /**
   * If true, close button will be added to notification to dismiss.
   * If number, notification will be "auto dismissed" after that duration.
   * If 'auto', it will auto dissmiss after default duration */
  dismissible?: boolean | number | 'auto';
}

export type TypedNotificationInput = Omit<NotificationInput, 'type' | 'priority'>;
export type VarientNotificationInput = Omit<NotificationInput, 'variant'>;

export type FatalNotificationInput = Omit<TypedNotificationInput, 'dismissible' | 'onDismiss'>;

export type BriefNotificationInput = Omit<VarientNotificationInput, 'dismissible' | 'elementOptions'> & {
  elementOptions?: BriefOptions;
};

export interface NotificationEvents {
  ADDED: [notification: Notification];
  DISMISSED: [notification: Notification];
}

export interface AddedNotificationHandler {
  (...args: NotificationEvents['ADDED']): void;
}

export interface DismissedNotificationHandler {
  (...args: NotificationEvents['DISMISSED']): void;
}

export interface OnAddedNotification {
  /** Adds listener for "ADDED" notification events and returns callback to remove listener. */
  (listener: AddedNotificationHandler): () => void;
}

export interface OnDismissedNotification {
  /** Adds listener for "DISMISSED" notification events and returns callback to remove listener. */
  (listener: DismissedNotificationHandler): () => void;
}

export class NotificationEmitter extends EventEmitter<NotificationEvents> {
  constructor() {
    super();
  }
}
