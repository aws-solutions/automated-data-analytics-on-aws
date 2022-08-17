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
import { DataProductInput } from '@ada/api-client';
import { DataProductStore } from '../../../components/ddb/data-product';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { KMS } from 'aws-sdk';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api/client/types';
import { handler } from '../put-data-product';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

const mockStartExecution = jest.fn();
const mockCreateSecret = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  KMS: jest.fn().mockImplementation(() => ({
    decrypt: () => ({
      promise: jest.fn<Promise<KMS.DecryptResponse>, any[]>(() =>
        Promise.resolve({ EncryptionAlgorithm: 'SHA256', KeyId: 'MockKeyID', Plaintext: 'Mocked' }),
      ),
    }),
  })),
  StepFunctions: jest.fn().mockImplementation(() => ({
    startExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartExecution(...args))),
    }),
  })),
  SecretsManager: jest.fn().mockImplementation(() => ({
    createSecret: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockCreateSecret(...args))),
    }),
  })),
}));

describe('put-data-product-relationships', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  const domainId = 'test-domain';
  const dataProductId = 'my-data-product';

  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.resetAllMocks();
    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
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
        pathParameters: { domainId: domainId, dataProductId },
        body: dataProduct,
        multiValueQueryStringParameters,
      }) as any,
      null,
    );

  it('should update an existing data product and relate its new ontologies', async () => {
    // Put an existing data product in the store
    const currentDataProduct = await testDataProductStore.putDataProduct(domainId, dataProductId, 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId,
      dataProductId,
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
    });
    // Write the relationship to the domain since that would be created by posting the new data product
    await relationshipClient.addRelationships(
      callingUser,
      entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }),
      [entityIdentifier('DataProductDomain', { domainId })],
    );

    const dataSets = {
      myDataSet: {
        columnMetadata: {
          name: {
            dataType: 'string',
            ontologyNamespace: 'default',
            ontologyAttributeId: 'name',
          },
          age: {
            dataType: 'int',
            ontologyNamespace: 'default',
            ontologyAttributeId: 'age',
          },
        },
        identifiers: {},
      },
    };

    // Update the data product, with some ontologies mapped
    const response = await putDataProductHandler(dataProductId, {
      ...currentDataProduct,
      domainId,
      dataProductId,
      name: 'New Name',
      infrastructureStatus: DataProductInfrastructureStatus.READY,
      dataStatus: DataProductDataStatus.READY,
      dataSets,
    });
    expect(response.statusCode).toBe(200);

    // Check the dataProduct is written to dynamodb
    expect(await testDataProductStore.getDataProduct(domainId, dataProductId)).toEqual(
      expect.objectContaining({
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        domainId,
        dataProductId,
        name: 'New Name',
        infrastructureStatus: DataProductInfrastructureStatus.READY,
        dataStatus: DataProductDataStatus.READY,
        createdBy: 'creator',
        updatedBy: 'test-user',
        dataSets,
      }),
    );

    // Shouldn't have kicked off any infrastructure creation
    expect(mockStartExecution).not.toHaveBeenCalled();

    // It should relate the ontologies that were mapped, and the domain that the data product belongs to
    expect(
      await relationshipClient.getRelatedEntities(
        entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }),
      ),
    ).toIncludeSameMembers([
      entityIdentifier('DataProductDomain', { domainId }),
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'age' }),
    ]);
  });
});
