/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductDataStatus } from '@ada/common';
import { DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import { DataProductStore } from '../../../components/ddb/data-product';
import { NOTIFICATION_BUS_ARN_ENV, NotificationClient } from '../../../../api/components/notification/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildSource } from '../../../../api/components/notification/common';
import { handler } from '../put-start-data-product-data-update';

// Mock the dataProduct store to point to our local dynamodb
const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
DataProductStore.getInstance = jest.fn(() => testDataProductStore);

const mockPutEvents = jest.fn();
const mockEventBridge = {
  putEvents: (...args: any[]) => ({
    promise: jest.fn(() => Promise.resolve(mockPutEvents(...args))),
  }),
};

describe('put-start-data-product-data-update', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    process.env[NOTIFICATION_BUS_ARN_ENV] = 'arn:aws:events:us-test-2:012345678910:bus/notification';

    // Reset the notification store to ensure we use the mocked eventbridge
    // @ts-ignore
    NotificationClient.getInstance = jest.fn(() => new NotificationClient(mockEventBridge));
  });

  afterEach(() => {
    delete process.env[NOTIFICATION_BUS_ARN_ENV];
  });

  // Helper method for calling the handler
  const startDataUpdateHandler = (dataProductId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId: 'test-domain', dataProductId },
      }),
      null,
    );

  it('should update the data status to updating and send the on demand update event', async () => {
    await testDataProductStore.putDataProduct('test-domain', 'my-dp-id', 'test-user', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataStatus: DataProductDataStatus.READY,
    });

    const response = await startDataUpdateHandler('my-dp-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        dataProductId: 'my-dp-id',
        dataStatus: DataProductDataStatus.UPDATING,
      }),
    );

    expect(process.env[NOTIFICATION_BUS_ARN_ENV]).toBeDefined();
    expect(mockPutEvents).toHaveBeenCalledWith({
      Entries: [
        {
          EventBusName: process.env[NOTIFICATION_BUS_ARN_ENV],
          Source: buildSource(EventSource.DATA_PRODUCTS),
          DetailType: DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE,
          Detail: JSON.stringify({ domainId: 'test-domain', dataProductId: 'my-dp-id' }),
        },
      ],
    });
  });

  it('should return 404 if the data product does not exist', async () => {
    const response = await startDataUpdateHandler('does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('does-not-exist');
  });

  it('should return 400 if the data is already updating', async () => {
    await testDataProductStore.putDataProduct('test-domain', 'my-dp-id', 'test-user', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataStatus: DataProductDataStatus.UPDATING,
    });

    const response = await startDataUpdateHandler('my-dp-id');
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Cannot trigger a new data update');
  });
});
