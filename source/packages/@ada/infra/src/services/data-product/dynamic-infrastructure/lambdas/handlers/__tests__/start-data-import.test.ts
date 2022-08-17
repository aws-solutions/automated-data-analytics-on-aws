/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductDataStatus } from '@ada/common';
import { DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import { DataProductStore } from '../../../../components/ddb/data-product';
import { INotificationClient, NotificationClient } from '../../../../../api/components/notification/client';
import { handler } from '../start-data-import';
import { noopMockLockClient } from '../../../../../api/components/entity/locks/mock';

const mockListExecutions = jest.fn();
const mockStartExecution = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    listExecutions: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListExecutions(...args))),
    }),
    startExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartExecution(...args))),
    }),
  })),
}));

// Mock the NotificationClient
const mockNotificationClient: INotificationClient = {
  send: jest.fn(),
};
NotificationClient.getInstance = jest.fn(() => mockNotificationClient);

describe('start-data-import', () => {
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  const stateMachineArn = 'my:state:machine:arn';
  const domainId = 'domain';
  const dataProductId = 'data-product';

  const startDataImport = () =>
    handler(
      {
        stateMachineArn: 'my:state:machine:arn',
        dataProductIdentifier: { domainId, dataProductId },
        callingUser: DEFAULT_CALLER,
      },
      null,
    );

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    noopMockLockClient();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);
  });

  it('should start a data import when there are no executions', async () => {
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId,
      dataProductId,
    });
    mockListExecutions.mockReturnValue({
      executions: [],
    });

    await startDataImport();

    expect(mockStartExecution).toHaveBeenCalledWith({ stateMachineArn });
    expect(await testDataProductStore.getDataProduct(domainId, dataProductId)).toEqual(
      expect.objectContaining({
        dataStatus: DataProductDataStatus.UPDATING,
      }),
    );
  });

  it('should start a data import when the latest execution has finished', async () => {
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId,
      dataProductId,
    });
    mockListExecutions.mockReturnValue({
      executions: [{ status: 'SUCCEEDED' }],
    });

    await startDataImport();

    expect(mockStartExecution).toHaveBeenCalledWith({ stateMachineArn });
    expect(await testDataProductStore.getDataProduct(domainId, dataProductId)).toEqual(
      expect.objectContaining({
        dataStatus: DataProductDataStatus.UPDATING,
      }),
    );
  });

  it('should not start a data import when the latest execution is still running', async () => {
    mockListExecutions.mockReturnValue({
      executions: [{ status: 'RUNNING' }],
    });

    await startDataImport();

    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: DEFAULT_CALLER.userId,
        type: DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_START_FAILED,
        source: EventSource.DATA_PRODUCTS,
      }),
    );
  });

  it('should not start a data import when the data product does not exist', async () => {
    mockListExecutions.mockReturnValue({
      executions: [{ status: 'SUCCEEDED' }],
    });

    await startDataImport();

    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockNotificationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: DEFAULT_CALLER.userId,
        type: DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_START_FAILED,
        source: EventSource.DATA_PRODUCTS,
      }),
    );
  });
});
