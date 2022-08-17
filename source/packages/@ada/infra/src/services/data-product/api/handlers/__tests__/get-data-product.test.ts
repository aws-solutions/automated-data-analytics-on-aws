/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductAccess, DataProductSourceDataStatus, LensIds } from '@ada/common';
import {
  DataProductPolicy,
  GetGovernancePolicyAttributeValuesResponse,
  GetGovernancePolicyAttributesResponse,
  Ontology,
} from '@ada/api-client';
import { DataProductStore } from '../../../components/ddb/data-product';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get-data-product';

jest.mock('@ada/api-client-lambda');

// Mock the dataProduct store to point to our local dynamodb
const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
DataProductStore.getInstance = jest.fn(() => testDataProductStore);

const mockListExecutions = jest.fn();

jest.mock('@ada/jwt-signer');

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    listExecutions: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListExecutions(...args))),
    }),
  })),
}));

describe('get-data-product', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue(
      apiClientErrorResponse(404, { message: 'no default lens policy' }),
    );
    API.getGovernancePolicyDomainDataProduct.mockResolvedValue(<DataProductPolicy>{
      domainId: 'my-domain-id',
      dataProductId: 'my-dp-id',
      permissions: {
        'power-user': {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });
  });

  // Helper method for calling the handler
  const getDataProductHandler = (domainId: string, dataProductId: string): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(
        { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['power-user'] },
        {
          pathParameters: { domainId, dataProductId },
        },
      ) as any,
      null,
    );

  it('should return a data product if the dataProductId exists', async () => {
    // Create our new dataProduct
    await testDataProductStore.putDataProduct('my-domain-id', 'my-dp-id', 'test-user', DEFAULT_S3_SOURCE_DATA_PRODUCT);

    const response = await getDataProductHandler('my-domain-id', 'my-dp-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        domainId: 'my-domain-id',
        dataProductId: 'my-dp-id',
      }),
    );
  });

  it.each(['FAILED', 'TIMED_OUT', 'ABORTED'])(
    'should return a failed status when the data product is updating but the import state machine is %s',
    async (status) => {
      // Create our new dataProduct
      await testDataProductStore.putDataProduct('my-domain-id', 'my-dp-id', 'test-user', {
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        dataStatus: DataProductSourceDataStatus.UPDATING,
        dataImportStateMachineArn: 'my:import:state:machine',
      });

      mockListExecutions.mockReturnValue({ executions: [{ status }] });

      const response = await getDataProductHandler('my-domain-id', 'my-dp-id');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(
        expect.objectContaining({
          ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
          domainId: 'my-domain-id',
          dataProductId: 'my-dp-id',
          dataStatus: DataProductSourceDataStatus.FAILED,
          dataStatusDetails: `Import state machine failed with status ${status}`,
        }),
      );
    },
  );

  it('should return 404 if dataProduct does not exist', async () => {
    const response = await getDataProductHandler('some-domain', 'does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('does-not-exist');
  });

  it('should return 403 if user does not have access to the data product', async () => {
    // Create our new dataProduct
    await testDataProductStore.putDataProduct('my-domain-id', 'my-dp-id', 'test-user', DEFAULT_S3_SOURCE_DATA_PRODUCT);

    API.getGovernancePolicyDomainDataProduct.mockResolvedValue(<DataProductPolicy>{
      domainId: 'my-domain-id',
      dataProductId: 'my-dp-id',
      permissions: {
        'some-other-group': {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });
    const response = await getDataProductHandler('my-domain-id', 'my-dp-id');
    expect(response.statusCode).toBe(403);
  });

  it('should return governed dataset details when there are datasets', async () => {
    // Create our data product with some datasets
    await testDataProductStore.putDataProduct('my-domain-id', 'my-dp-id', 'test-user', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataSets: {
        myDataSet: {
          identifiers: {
            catalog: 'AwsDataCatalog',
            database: 'default',
            table: 'test',
          },
          columnMetadata: {
            firstName: {
              description: 'The customer first name',
              dataType: 'string',
              ontologyAttributeId: 'name-attribute-id',
              ontologyNamespace: 'namespace',
            },
            lastName: {
              description: 'The customer last name',
              dataType: 'string',
              ontologyAttributeId: 'name-attribute-id',
              ontologyNamespace: 'namespace',
            },
            email: { description: 'The customer email', dataType: 'string' },
            age: { description: 'The customer age', dataType: 'bigint' },
          },
        },
      },
    });

    API.getOntology.mockResolvedValue({
      ontologyId: 'name-attribute-id',
      ontologyNamespace: 'namespace',
      description: 'A name',
      defaultLens: LensIds.CLEAR,
    } as Ontology);

    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HASHED,
      },
    } as GetGovernancePolicyAttributesResponse);

    API.getGovernancePolicyAttributeValues.mockResolvedValue({
      attributeIdToSqlClause: {
        'namespace.name-attribute-id': '"namespace.name-attribute-id" like "%Vader"',
      },
    } as GetGovernancePolicyAttributeValuesResponse);

    const response = await getDataProductHandler('my-domain-id', 'my-dp-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        domainId: 'my-domain-id',
        dataProductId: 'my-dp-id',
        dataSets: {
          myDataSet: {
            identifiers: {
              catalog: 'AwsDataCatalog',
              database: 'default',
              table: 'test',
            },
            columnMetadata: {
              firstName: {
                description: 'The customer first name',
                dataType: 'string',
                ontologyAttributeId: 'name-attribute-id',
                ontologyNamespace: 'namespace',
                lensToApply: LensIds.HASHED,
                sqlClauses: ['"namespace.name-attribute-id" like "%Vader"'],
              },
              lastName: {
                description: 'The customer last name',
                dataType: 'string',
                ontologyAttributeId: 'name-attribute-id',
                ontologyNamespace: 'namespace',
                lensToApply: LensIds.HASHED,
                sqlClauses: ['"namespace.name-attribute-id" like "%Vader"'],
              },
              email: {
                description: 'The customer email',
                dataType: 'string',
                lensToApply: LensIds.CLEAR,
                sqlClauses: [],
              },
              age: {
                description: 'The customer age',
                dataType: 'bigint',
                lensToApply: LensIds.CLEAR,
                sqlClauses: [],
              },
            },
          },
        },
      }),
    );
  });
});
