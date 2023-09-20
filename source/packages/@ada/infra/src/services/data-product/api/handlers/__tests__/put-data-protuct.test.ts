/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess, DataProductDataStatus, DataProductInfrastructureStatus } from '@ada/common';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductInput } from '@ada/api';
import { DataProductStore } from '../../../components/ddb/data-product';
import { KMS } from 'aws-sdk';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-data-product';
import { noopMockLockClient } from '../../../../api/components/entity/locks/mock';
import { noopMockRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');
const mockStartExecution = jest.fn();
const mockCreateSecret = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsKMSInstance: jest.fn().mockImplementation(() => ({
    decrypt: () => ({
      promise: jest.fn<Promise<KMS.DecryptResponse>, any[]>(() =>
        Promise.resolve({ EncryptionAlgorithm: 'SHA256', KeyId: 'MockKeyID', Plaintext: 'Mocked' }),
      ),
    }),
  })),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    startExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartExecution(...args))),
    }),
  })),
  SecretsManager: jest.fn().mockImplementation(() => ({
    createSecret: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockCreateSecret(...args))),
    }),
  })),
  AwsLambdaInstance: jest.fn().mockImplementation(() => ({
    invoke: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockInvoke(...args))),
    }),
  })),
}));

describe('put-data-product', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  const before = '2021-01-01T00:00:00.000Z';
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.resetAllMocks();
    noopMockLockClient();
    noopMockRelationshipClient();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);

    // Allow admin to edit
    API.getGovernancePolicyDomainDataProduct.mockResolvedValue({
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
      },
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const callingUser: CallingUser = { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['admin'] };

  // Helper method for calling the handler
  const putDataProductHandler = (
    dataProductId: string,
    dataProduct: DataProductInput,
    multiValueQueryStringParameters?: any,
    caller: CallingUser = callingUser,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(caller, {
        pathParameters: { domainId: 'test-domain', dataProductId },
        body: dataProduct,
        multiValueQueryStringParameters,
      }) as any,
      null,
    );

  it('should not create a new data product', async () => {
    // Create our new dataProduct
    const response = await putDataProductHandler('my-data-product', DEFAULT_S3_SOURCE_DATA_PRODUCT);
    expect(response.statusCode).toBe(404);
  });

  it('should update an existing data product', async () => {
    // Put an existing data product in the store
    const currentDataProduct = await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    expect(currentDataProduct.updatedTimestamp).toEqual(now);

    // Update the data product
    const response = await putDataProductHandler('my-data-product', {
      ...currentDataProduct,
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    expect(response.statusCode).toBe(200);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-data-product')).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
      createdBy: 'creator',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    });

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should update an existing data product event if updatedTimestamp does not match', async () => {
    // Put an existing data product in the store
    const currentDataProduct = await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    const oldDataProduct = currentDataProduct;
    oldDataProduct.updatedTimestamp = before;

    // Update the data product
    const response = await putDataProductHandler('my-data-product', {
      ...currentDataProduct,
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    expect(response.statusCode).toBe(200);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-data-product')).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
      createdBy: 'creator',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    });
    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
  });

  it('should not allow updating a data product without full permissions', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    // Try to update the data product
    const response = await putDataProductHandler(
      'my-data-product',
      {
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        name: 'New Name',
        infrastructureStatus: DataProductInfrastructureStatus.READY,
        dataStatus: DataProductDataStatus.READY,
      },
      [],
      { userId: 'not-permitted', username: 'not-permitted@usr.example.com', groups: ['no-permissions'] },
    );

    expect(response.statusCode).toBe(403);
  });

  it('should not allow updating infrastructure related fields of a data product', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    // Update the data product
    const response = await putDataProductHandler('my-data-product', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      sourceDetails: {
        bucket: 'my-new-s3-bucket',
        key: 'my-new-s3-key',
      },
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('sourceDetails');

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
