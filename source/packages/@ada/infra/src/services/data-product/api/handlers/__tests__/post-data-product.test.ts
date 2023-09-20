/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, ApiOperationRequest, entityIdentifier } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CallingUser,
  DataProductAccess,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductSourceDataStatus,
  ReservedDataProducts,
} from '@ada/common';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductInput } from '@ada/api';
import { DataProductStore } from '../../../components/ddb/data-product';
import { KMS } from 'aws-sdk';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../post-data-product';
import { noopMockLockClient } from '../../../../api/components/entity/locks/mock';
import { noopMockRelationshipClient } from '../../../../api/components/entity/relationships/mock';
import { Connectors } from '@ada/connectors';
import { ISourceDetails__GOOGLE_STORAGE } from '@ada/connectors/sources/google_storage';
import { MOCK_GOOGLE_SERVICE_ACCOUNT, MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT } from '@ada/connectors/common/google/testing';
import { METRICS_EVENT_TYPE, OperationalMetricsClient } from '@ada/services/api/components/operational-metrics/client';

jest.mock('@ada/api-client-lambda');
const mockStartExecution = jest.fn();
const mockCreateSecret = jest.fn();
const mockInvoke = jest.fn();
const mockSendOperationalMetrics = jest.fn();

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
  AwsSecretsManagerInstance: jest.fn().mockImplementation(() => ({
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

describe('post-data-product', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
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

    OperationalMetricsClient.getInstance = jest.fn(() => ({
      send: mockSendOperationalMetrics
    }));
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const callingUser: CallingUser = { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['admin'] };

  // Helper method for calling the handler
  const postDataProductHandler = (
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

  it('should create a new data product', async () => {
    // Create our new dataProduct
    const response = await postDataProductHandler('my-data-product', DEFAULT_S3_SOURCE_DATA_PRODUCT);
    expect(response.statusCode).toBe(200);

    const expectedDataProduct = {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      dataStatus: DataProductDataStatus.NO_DATA,
      // Updating as s3 source is supported for source data quering
      sourceDataStatus: DataProductSourceDataStatus.UPDATING,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDataProduct);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-data-product')).toEqual(expectedDataProduct);

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.CREATE_DATA_PRODUCT_STATE_MACHINE_ARN!,
      input: JSON.stringify({
        Payload: {
          dataProduct: expectedDataProduct,
          callingUser,
        },
      }),
    });
    expect(mockInvoke).toHaveBeenCalled();

    // Should set the default policy
    expect(API.putGovernancePolicyDomainDataProduct).toHaveBeenCalledWith<
      [ApiOperationRequest<'putGovernancePolicyDomainDataProduct'>]
    >({
      domainId: 'test-domain',
      dataProductId: 'my-data-product',
      dataProductPolicyInput: {
        permissions: {
        },
      },
    });
    expect(mockCreateSecret).not.toHaveBeenCalled();

    expect(mockSendOperationalMetrics).toHaveBeenCalledWith({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_CREATED,
      connector: expectedDataProduct.sourceType,
    });
  });

  it('should create a new data product and store secrets if the product requires it', async () => {
    mockCreateSecret.mockReturnValue({
      Name: MOCK_GOOGLE_SERVICE_ACCOUNT.privateKeySecretName,
    });

    const inputDataProduct: DataProductInput = {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      sourceType: Connectors.Id.GOOGLE_STORAGE,
      sourceDetails: {
        bucket: 'my-bucket',
        key: 'my-key',
        ...MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT,
      } as ISourceDetails__GOOGLE_STORAGE,
    };
    const response = await postDataProductHandler('my-google-data-product', inputDataProduct);
    expect(response.statusCode).toBe(200);

    const expectedDataProduct = {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      sourceType: Connectors.Id.GOOGLE_STORAGE,
      sourceDetails: {
        bucket: 'my-bucket',
        key: 'my-key',
        ...MOCK_GOOGLE_SERVICE_ACCOUNT,
      } as ISourceDetails__GOOGLE_STORAGE,
      dataProductId: 'my-google-data-product',
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      dataStatus: DataProductDataStatus.NO_DATA,
      sourceDataStatus: DataProductSourceDataStatus.NO_DATA,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDataProduct);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-google-data-product')).toEqual(
      expectedDataProduct,
    );

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.CREATE_DATA_PRODUCT_STATE_MACHINE_ARN!,
      input: JSON.stringify({
        Payload: {
          dataProduct: expectedDataProduct,
          callingUser,
        },
      }),
    });
    expect(mockInvoke).toHaveBeenCalled();

    // Should have created the secret as this is google storage
    expect(mockCreateSecret).toHaveBeenCalledWith({
      Name: expect.stringMatching(/DPSecrets-data-product-test.*/),
      SecretString: MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT.privateKey,
    });
    expect(mockCreateSecret.name.length).toBeLessThanOrEqual(512);
  });

  it('should create a new data product with initial full access groups', async () => {
    // Create our new dataProduct
    const response = await postDataProductHandler('my-data-product', DEFAULT_S3_SOURCE_DATA_PRODUCT, {
      initialFullAccessGroups: ['my-group', 'my-other-group'],
    });
    expect(response.statusCode).toBe(200);

    const expectedDataProduct = {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      dataStatus: DataProductDataStatus.NO_DATA,
      // Updating as s3 source is supported for source data quering
      sourceDataStatus: DataProductSourceDataStatus.UPDATING,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDataProduct);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-data-product')).toEqual(expectedDataProduct);

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.CREATE_DATA_PRODUCT_STATE_MACHINE_ARN!,
      input: JSON.stringify({
        Payload: {
          dataProduct: expectedDataProduct,
          callingUser,
        },
      }),
    });
    expect(mockInvoke).toHaveBeenCalled();

    // Should set the default policy with the full access groups
    expect(API.putGovernancePolicyDomainDataProduct).toHaveBeenCalledWith<
      [ApiOperationRequest<'putGovernancePolicyDomainDataProduct'>]
    >({
      domainId: 'test-domain',
      dataProductId: 'my-data-product',
      dataProductPolicyInput: {
        permissions: {
          'my-group': {
            access: DataProductAccess.FULL,
          },
          'my-other-group': {
            access: DataProductAccess.FULL,
          },
        },
      },
    });
  });

  it('should not allow creating a data product with inline scripts', async () => {
    const response = await postDataProductHandler('my-data-product', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      transforms: [
        { namespace: 'test-domain', scriptId: 'my_good_script' },
        { namespace: 'test-domain', scriptId: 'my_bad_script', inlineScriptContent: 'script!' },
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my_bad_script');
    expect(response.body).not.toContain('my_good_script');

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not allow creating a data product with a script in a different domain', async () => {
    const response = await postDataProductHandler('my-data-product', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      transforms: [
        { namespace: 'test-domain', scriptId: 'my_good_script' },
        { namespace: 'another-domain', scriptId: 'my_bad_script' },
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toMatch('my_bad_script');
    expect(response.body).not.toMatch('my_good_script');

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not update an existing data product', async () => {
    // Put an existing data product in the store
    const currentDataProduct = await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    expect(currentDataProduct.updatedTimestamp).toEqual(now);

    // Update the data product
    const response = await postDataProductHandler('my-data-product', {
      ...currentDataProduct,
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    expect(response.statusCode).toBe(400);
  });

  it('should NOT create data product if same id exists', async () => {
    // Put a data product in the store
    await testDataProductStore.putDataProduct('test-domain', 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });

    // Put duplicate item
    const response = await postDataProductHandler('my-data-product', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    expect(response.statusCode).toBe(400);

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();
  });

  it.each(Object.values(ReservedDataProducts))(
    'should not create a data product with a reserved dataProductId %s',
    async (dataProductId) => {
      const response = await postDataProductHandler(dataProductId, DEFAULT_S3_SOURCE_DATA_PRODUCT);
      expect(response.statusCode).toBe(400);
    },
  );

  it('should create data product with duplicated transformations', async () => {
    const mockLockClient = noopMockLockClient();
    const mockRelatioshipClient = noopMockRelationshipClient();

    const response = await postDataProductHandler('my-data-product', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      transforms: [
        { namespace: 'global', scriptId: 'ada_json_relationalise' },
        { namespace: 'global', scriptId: 'ada_json_relationalise' },
      ],
    });

    // Test lock id is unique for script
    const scriptLockIds = [
      entityIdentifier('DataProductScript', { namespace: 'global', scriptId: 'ada_json_relationalise' }),
    ];
    expect(mockLockClient.acquire).toHaveBeenCalledWith(...scriptLockIds);

    // Test relationship id is unique across product and script (2nd call)
    const relationshipLockId = entityIdentifier('DataProductDomainDataProduct', {
      domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
      dataProductId: 'my-data-product',
    });
    expect(mockRelatioshipClient.addRelationships).toHaveBeenNthCalledWith(
      2,
      callingUser,
      relationshipLockId,
      scriptLockIds,
    );

    expect(response.statusCode).toBe(200);

    const expectedDataProduct = {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      transforms: [
        { namespace: 'global', scriptId: 'ada_json_relationalise' },
        { namespace: 'global', scriptId: 'ada_json_relationalise' },
      ],
      dataProductId: 'my-data-product',
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
      dataStatus: DataProductDataStatus.NO_DATA,
      // Updating as s3 source is supported for source data quering
      sourceDataStatus: DataProductSourceDataStatus.UPDATING,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDataProduct);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct('test-domain', 'my-data-product')).toEqual(expectedDataProduct);

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.CREATE_DATA_PRODUCT_STATE_MACHINE_ARN!,
      input: JSON.stringify({
        Payload: {
          dataProduct: expectedDataProduct,
          callingUser,
        },
      }),
    });
    expect(mockInvoke).toHaveBeenCalled();

    // Should set the default policy
    expect(API.putGovernancePolicyDomainDataProduct).toHaveBeenCalledWith<
      [ApiOperationRequest<'putGovernancePolicyDomainDataProduct'>]
    >({
      domainId: 'test-domain',
      dataProductId: 'my-data-product',
      dataProductPolicyInput: {
        permissions: {
        },
      },
    });
    expect(mockCreateSecret).not.toHaveBeenCalled();
  });

  it.each(Object.values(ReservedDataProducts))(
    'should not create a data product with a reserved dataProductId %s',
    async (dataProductId) => {
      const response = await postDataProductHandler(dataProductId, DEFAULT_S3_SOURCE_DATA_PRODUCT);
      expect(response.statusCode).toBe(400);
    },
  );
});
