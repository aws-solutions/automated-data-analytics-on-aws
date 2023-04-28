/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess, DataProductDataStatus, DataProductInfrastructureStatus } from '@ada/common';
import { CreateAndUpdateDetails, DataProduct } from '@ada/api';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { METRICS_EVENT_TYPE, OperationalMetricsClient } from '@ada/services/api/components/operational-metrics/client';
import { DataProductStore } from '../../../components/ddb/data-product';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api/client/types';
import { handler } from '../delete-data-product';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';
import { Connectors } from '@ada/connectors';
import { ISourceDetails__GOOGLE_BIGQUERY } from '@ada/connectors/sources/google_bigquery';

jest.mock('@ada/api-client-lambda');

const mockDeleteStack = jest.fn();
const mockDeleteSecret = jest.fn();
const mockListExecutions = jest.fn();
const mockSendOperationalMetrics = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCloudFormationInstance: jest.fn().mockImplementation(() => ({
    deleteStack: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteStack(...args))),
    }),
  })),
  AwsSecretsManagerInstance: jest.fn().mockImplementation(() => ({
    deleteSecret: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteSecret(...args))),
    }),
  })),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    listExecutions: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListExecutions(...args))),
    }),
  })),
}));

const domainId = 'test-domain';
const dataProductId = 'test-data-product';
const dataProductIdentifier = { domainId, dataProductId };
const dataProductEntity = entityIdentifier('DataProductDomainDataProduct', dataProductIdentifier);
const dataProduct: DataProduct & CreateAndUpdateDetails = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId,
  dataProductId,
  cloudFormationStackId: 'data-product-infra-stack',
  dataStatus: DataProductDataStatus.READY,
  infrastructureStatus: DataProductInfrastructureStatus.READY,
};

describe('delete-data-product', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());

  let relationshipClient: IRelationshipClient;

  let currentDataProduct: DataProduct & CreateAndUpdateDetails;
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.resetAllMocks();

    relationshipClient = localDynamoRelationshipClient();
    localDynamoLockClient();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);

    // Allow admin to edit
    API.getGovernancePolicyDomainDataProduct.mockResolvedValue({
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
      },
    });

    currentDataProduct = await testDataProductStore.putDataProduct(
      domainId,
      dataProductId,
      DEFAULT_CALLER.userId,
      dataProduct,
    );

    OperationalMetricsClient.getInstance = jest.fn(() => ({
      send: mockSendOperationalMetrics,
    }));
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const deleteDataProductHandler = (
    dataProductId: string,
    caller: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(caller, {
        pathParameters: { domainId, dataProductId },
      }) as any,
      null,
    );

  it('should return 404 when the data product does not exist', async () => {
    expect((await deleteDataProductHandler('does-not-exist')).statusCode).toBe(404);
  });

  it('should return 403 when the caller does not have full access', async () => {
    expect(
      (
        await deleteDataProductHandler(dataProductId, {
          ...DEFAULT_CALLER,
          userId: 'somebody',
          groups: ['useless-group'],
        })
      ).statusCode,
    ).toBe(403);
  });

  it('should not permit deleting a data product that is currently importing data and there is not dataImportStateMachineArn associated with it', async () => {
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...currentDataProduct,
      dataStatus: DataProductDataStatus.UPDATING,
    });

    mockListExecutions.mockReturnValue({ executions: [{ status: 'FAILED' }] });

    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(400);
  });

  it.each(['RUNNING', 'SUCCEEDED'])(
    'should not permit deleting a data product that is currently importing data and the import state machine is %s',
    async (status) => {
      await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
        ...currentDataProduct,
        dataStatus: DataProductDataStatus.UPDATING,
        dataImportStateMachineArn: 'my:import:state:machine',
      });

      mockListExecutions.mockReturnValue({ executions: [{ status }] });

      const response = await deleteDataProductHandler(dataProductId);
      expect(response.statusCode).toBe(400);
    },
  );

  it.each(['FAILED', 'TIMED_OUT', 'ABORTED'])(
    'should permit deleting a data product that is currently importing data but the import state machine is %s',
    async (status) => {
      await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
        ...currentDataProduct,
        dataStatus: DataProductDataStatus.UPDATING,
        dataImportStateMachineArn: 'my:import:state:machine',
      });

      mockListExecutions.mockReturnValue({ executions: [{ status }] });

      const response = await deleteDataProductHandler(dataProductId);
      expect(response.statusCode).toBe(200);
    },
  );

  it('should not permit deleting a data product that is currently building', async () => {
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...currentDataProduct,
      infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
    });
    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(400);
  });

  it('should not permit deleting a data product with children', async () => {
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...currentDataProduct,
      childDataProducts: [{ domainId, dataProductId: 'my-child-data-product' }],
    });
    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('my-child-data-product');
  });

  it('should not permit deleting a data product referenced by saved queries', async () => {
    await relationshipClient.addRelationships(DEFAULT_CALLER, dataProductEntity, [
      entityIdentifier('QuerySavedQuery', { namespace: 'some', queryId: 'query' }),
    ]);
    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('some.query');
  });

  it('should delete a data product', async () => {
    // Relate the data product to its policies
    await relationshipClient.addRelationships(DEFAULT_CALLER, dataProductEntity, [
      entityIdentifier('GovernancePolicyDomainDataProduct', dataProductIdentifier),
      entityIdentifier('GovernancePolicyDefaultLensDomainDataProduct', dataProductIdentifier),
    ]);

    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(dataProduct));

    expect(await relationshipClient.getRelatedEntities(dataProductEntity)).toHaveLength(0);

    expect(API.deleteGovernancePolicyDomainDataProduct).toHaveBeenCalledWith(dataProductIdentifier);
    expect(API.deleteGovernancePolicyDefaultLensDomainDataProduct).toHaveBeenCalledWith(dataProductIdentifier);

    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'data-product-infra-stack' });

    expect(mockSendOperationalMetrics).toHaveBeenCalledWith({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: dataProduct.sourceType,
    });
  });

  it('should update parent data products child references', async () => {
    const dataProductWithParent = {
      ...currentDataProduct,
      parentDataProducts: [{ domainId, dataProductId: 'my-parent-data-product' }],
    };
    const dataProductWithParentUpdateRes = await testDataProductStore.putDataProduct(
      domainId,
      dataProductId,
      DEFAULT_CALLER.userId,
      dataProductWithParent,
    );

    const parentDataProduct = {
      ...dataProduct,
      name: 'The Parent',
      dataProductId: 'my-parent-data-product',
      childDataProducts: [
        { domainId, dataProductId: 'some-other-child' },
        { domainId, dataProductId },
      ],
    };

    await testDataProductStore.putDataProduct(
      domainId,
      'my-parent-data-product',
      DEFAULT_CALLER.userId,
      parentDataProduct,
    );

    const deleteResponse = await deleteDataProductHandler(dataProductId);
    expect(deleteResponse.statusCode).toBe(200);
    expect(JSON.parse(deleteResponse.body)).toEqual(
      expect.objectContaining({
        ...dataProductWithParent,
        updatedTimestamp: dataProductWithParentUpdateRes.updatedTimestamp,
      }),
    );

    const updatedDataProudct = await testDataProductStore.getDataProduct(domainId, 'my-parent-data-product');
    expect(updatedDataProudct).toEqual(
      expect.objectContaining({
        ...parentDataProduct,
        updatedTimestamp: updatedDataProudct.updatedTimestamp,
        // No more reference to the deleted data product
        childDataProducts: [{ domainId, dataProductId: 'some-other-child' }],
      }),
    );
  });

  it('should delete a data product with a stored secret', async () => {
    const dataProductId = 'bigquery-data-product';
    // Write a bigquery data product with a stored secret
    await testDataProductStore.putDataProduct(domainId, dataProductId, DEFAULT_CALLER.userId, {
      ...dataProduct,
      dataProductId,
      sourceType: Connectors.Id.GOOGLE_BIGQUERY,
      sourceDetails: <ISourceDetails__GOOGLE_BIGQUERY>{
        projectId: 'test',
        clientEmail: 'test',
        clientId: 'test',
        privateKeyId: 'test',
        privateKeySecretName: 'secret-name',
        query: 'select * from table',
      },
    });

    await relationshipClient.addRelationships(DEFAULT_CALLER, dataProductEntity, [
      entityIdentifier('GovernancePolicyDomainDataProduct', dataProductIdentifier),
      entityIdentifier('GovernancePolicyDefaultLensDomainDataProduct', dataProductIdentifier),
    ]);

    const response = await deleteDataProductHandler(dataProductId);
    expect(response.statusCode).toBe(200);

    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'data-product-infra-stack' });
    expect(mockDeleteSecret).toHaveBeenCalledWith({ SecretId: 'secret-name', ForceDeleteWithoutRecovery: true });
  });
});