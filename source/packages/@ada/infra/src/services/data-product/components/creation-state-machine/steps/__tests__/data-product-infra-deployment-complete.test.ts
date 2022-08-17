/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import {
  DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
} from '@ada/common';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import { DataProductStore } from '../../../ddb/data-product';
import { INotificationClient, NotificationClient } from '../../../../../api/components/notification/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../data-product-infra-deployment-complete';
import { noopMockLockClient } from '../../../../../api/components/entity/locks/mock';

const mockDescribeStacks = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCloudFormationInstance: jest.fn().mockImplementation(() => ({
    describeStacks: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeStacks(...args))),
    }),
  })),
}));

// Mock the NotificationClient
const mockNotificationClient: INotificationClient = {
  send: jest.fn(),
};

describe('data-product-infra-deployment-complete', () => {
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

  it('should update the data product status when infrastructure creation is successful', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_COMPLETE',
        },
      ],
    });
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });

    await handler(
      {
        Payload: {
          cloudFormationStackId: 'test-stack-id',
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );

    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });

    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        infrastructureStatus: DataProductInfrastructureStatus.READY,
        dataStatus: DataProductDataStatus.UPDATING,
      }),
    );

    expect(mockNotificationClient.send).toHaveBeenCalledWith({
      source: EventSource.DATA_PRODUCTS,
      type: DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE,
      payload: {
        domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        dataProductId: 'test-data-product',
      },
    });
  });

  it('should update the data product status when infrastructure creation fails', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_FAILED',
          StackStatusReason: 'SomeFailureReason',
        },
      ],
    });
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });

    await handler(
      {
        Payload: {
          cloudFormationStackId: 'test-stack-id',
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );

    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });

    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        infrastructureStatus: DataProductInfrastructureStatus.FAILED,
        infrastructureStatusDetails: 'SomeFailureReason',
        dataStatus: DataProductDataStatus.NO_DATA,
      }),
    );

    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        source: EventSource.DATA_PRODUCTS,
        type: DataProductEventDetailTypes.DATA_PRODUCT_BUILD_ERROR,
        target: 'test-user',
      }),
    );
  });

  it('should not override values that may have been updated during deployment', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_FAILED',
        },
      ],
    });
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      cloudFormationStackId: 'test-stack-id',
    });

    await handler(
      {
        Payload: {
          cloudFormationStackId: 'test-stack-id',
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

  it('should write the data import state machine arn if available in the outputs', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            {
              ExportName: `${DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX}SomeDataProductOutput`,
              OutputValue: 'my:state:machine:arn',
            },
          ],
        },
      ],
    });
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'test-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });

    await handler(
      {
        Payload: {
          cloudFormationStackId: 'test-stack-id',
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
        dataImportStateMachineArn: 'my:state:machine:arn',
      }),
    );
  });
});
