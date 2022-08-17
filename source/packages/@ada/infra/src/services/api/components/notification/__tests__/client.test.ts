/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { AwsEventBridgeInstance } from '@ada/aws-sdk';
import { Notification } from '@ada/api';
import { NotificationClient } from '../client';
import { VError } from 'verror';
import { recreateAllTables } from '@ada/microservice-test-common';

const mockPutEvents = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsEventBridgeInstance: jest.fn().mockImplementation(() => ({
    putEvents: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockPutEvents(...args))),
    }),
  })),
}));

const notificationOne: Notification = {
  type: 'Other',
  payload: { some: 'payload' },
  source: 'source',
};

describe('notification-client', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    process.env.NOTIFICATION_BUS_EVENT_BUS_ARN = 'notification-bus-arn';
  });

  it('should send notifications', async () => {
    const client: NotificationClient = new (NotificationClient as any)(AwsEventBridgeInstance());
    await client.send(notificationOne);
    expect(mockPutEvents).toHaveBeenCalled();
    expect(mockPutEvents).toHaveBeenCalledWith({
      Entries: [
        {
          EventBusName: 'notification-bus-arn',
          Source: 'ada.source',
          DetailType: notificationOne.type,
          Detail: JSON.stringify({ some: 'payload' }),
        },
      ],
    });
  });

  it('should throw error if NOTIFICATION_BUS_ARN_ENV is not set', async () => {
    delete process.env.NOTIFICATION_BUS_EVENT_BUS_ARN;

    expect(() => {
      new (NotificationClient as any)(AwsEventBridgeInstance());
    }).toThrow(VError);
  });
});
