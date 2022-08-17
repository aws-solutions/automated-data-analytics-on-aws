/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import { DataProductInfrastructureStatus } from '@ada/common';
import { DataProductStore } from '../../../ddb/data-product';
import { INotificationClient, NotificationClient } from '../../../../../api/components/notification/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../data-product-infra-deployment-failed';
import { noopMockLockClient } from '../../../../../api/components/entity/locks/mock';

// Mock the NotificationClient
const mockNotificationClient: INotificationClient = {
  send: jest.fn(),
};

describe('data-product-infra-deployment-failed', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.resetAllMocks();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);
    NotificationClient.getInstance = jest.fn(() => mockNotificationClient);
    noopMockLockClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  it('should update the data product with a failed status and error details', async () => {
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });

    await handler(
      {
        ErrorDetails: {
          Error: 'SomeError',
          Cause: JSON.stringify({ errorMessage: 'detailed error message' }),
        },
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );

    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        infrastructureStatus: DataProductInfrastructureStatus.FAILED,
        infrastructureStatusDetails: 'SomeError: detailed error message',
      }),
    );

    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'test-user',
        type: DataProductEventDetailTypes.DATA_PRODUCT_BUILD_ERROR,
        source: EventSource.DATA_PRODUCTS,
      }),
    );
  });

  it('should update the data product with a failed status and error when error cause is not json', async () => {
    await testDataProductStore.putDataProduct('test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });

    await handler(
      {
        ErrorDetails: {
          Error: 'SomeError',
          Cause: 'unparseable cause!',
        },
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );

    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        infrastructureStatus: DataProductInfrastructureStatus.FAILED,
        infrastructureStatusDetails: 'SomeError',
      }),
    );
  });

  it('should not override values that may have been updated during deployment', async () => {
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      cloudFormationStackId: 'test-stack-id',
    });

    await handler(
      {
        ErrorDetails: {
          Error: 'SomeError',
          Cause: JSON.stringify({ errorMessage: 'detailed error message' }),
        },
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );

    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        cloudFormationStackId: 'test-stack-id',
      }),
    );
  });
});
