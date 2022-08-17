/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { EventBridgePutEvents } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { EventBus, IEventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { NOTIFICATION_BUS_ARN_ENV } from '../client';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { buildEventDetailObject, buildSource } from '../common';
import type { Notification } from '@ada/api';

export interface SendNotificationsStateMachineTaskProps {
  readonly notifications: Notification[];
  readonly resultPath?: string;
}

export interface NotificationRuleProps {
  ruleName?: string;
  description?: string;
  notificationPattern: {
    source?: string[];
    type?: string[];
    payload?: any;
    target?: string[];
  };
}

/**
 * Notification bus wraps event bridge for sending and receiving notifications throughout the system
 */
export class INotificationBus extends Construct {
  public readonly eventBus: IEventBus;

  /**
   * Constructor wraps the event bus, such that the notification bus can be created from an existing event bridge event
   * bus.
   */
  constructor(scope: Construct, id: string, eventBus: IEventBus) {
    super(scope, id);
    this.eventBus = eventBus;
  }

  /**
   * Grants the necessary permissions and sets up the environment for a lambda to send notifications on the bus
   */
  public configureLambdaForNotifications(lambda: LambdaFunction): void {
    this.eventBus.grantPutEventsTo(lambda);
    lambda.addEnvironment(NOTIFICATION_BUS_ARN_ENV, this.eventBus.eventBusArn);
  }

  /**
   * Create a step functions state machine task for sending the given notifications
   */
  public sendNotificationsStateMachineTask = (id: string, props: SendNotificationsStateMachineTaskProps) => {
    return new EventBridgePutEvents(this, id, {
      entries: props.notifications.map((notification) => {
        const detail = buildEventDetailObject(notification.payload, notification.target);
        return {
          eventBus: this.eventBus,
          source: buildSource(notification.source),
          detailType: notification.type,
          detail: TaskInput.fromObject(detail || {}),
        };
      }),
    });
  };

  /**
   * Add an eventbridge rule that matches the given notification pattern
   */
  public addRule = (id: string, { ruleName, description, notificationPattern }: NotificationRuleProps) =>
    new Rule(this, id, {
      eventBus: this.eventBus,
      ruleName,
      description,
      eventPattern: {
        source: notificationPattern.source?.map((source) => buildSource(source)),
        detailType: notificationPattern.type,
        detail: buildEventDetailObject(notificationPattern.payload, notificationPattern.target),
      },
    });
}

/**
 * Send and receive notifications
 */
export class NotificationBus extends INotificationBus {
  /**
   * Create a notification bus from scratch
   */
  constructor(scope: Construct, id: string) {
    super(scope, id, new EventBus(scope, 'SharedEvntBus'));
  }

  /**
   * Create a notification bus from an existing event bridge event bus
   */
  public static fromEventBus = (scope: Construct, id: string, eventBus: IEventBus): INotificationBus =>
    new INotificationBus(scope, id, eventBus);
}
