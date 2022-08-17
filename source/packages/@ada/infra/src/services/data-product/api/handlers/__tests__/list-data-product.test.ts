/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { AccessEnum, DataProduct, DataProductPolicy } from '@ada/api';
import { CallingUser, DataProductAccess } from '@ada/common';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductStore } from '../../../components/ddb/data-product';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../list-data-product';
import { jest } from '@jest/globals';

jest.mock('@ada/api-client-lambda');

// Mock the domain store to point to our local dynamodb
const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
DataProductStore.getInstance = jest.fn(() => testDataProductStore);

describe('list-data-product', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    API.getGovernancePolicyDomainDataProduct.mockResolvedValue({
      permissions: {
        analyst: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });
  });

  // Helper method for calling the handler
  const listDataProductsHandler = (
    domainId: string,
    queryStringParameters: { [key: string]: string } = {},
    callingUser: CallingUser = { ...DEFAULT_CALLER, groups: ['analyst'] },
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        queryStringParameters,
        pathParameters: { domainId },
      }) as any,
      null,
    );

  const putGeneratedDataProduct = (domainId: string, dataProductId: string) =>
    testDataProductStore.putDataProduct(domainId, dataProductId, 'test-user', DEFAULT_S3_SOURCE_DATA_PRODUCT);

  it('should list data products within the given domain', async () => {
    let response = await listDataProductsHandler('some-domain');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).dataProducts).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await Promise.all([
      putGeneratedDataProduct('some-domain', 'list-data-products-test-1'),
      putGeneratedDataProduct('some-domain', 'list-data-products-test-2'),
      putGeneratedDataProduct('some-other-domain', 'another-domain-dp'),
      putGeneratedDataProduct('some-domain', 'list-data-products-test-3'),
      putGeneratedDataProduct('some-domain', 'list-data-products-test-4'),
    ]);

    response = await listDataProductsHandler('some-domain');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).dataProducts.map((o: DataProduct) => o.dataProductId)).toIncludeSameMembers([
      'list-data-products-test-1',
      'list-data-products-test-2',
      'list-data-products-test-3',
      'list-data-products-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    response = await listDataProductsHandler('some-other-domain');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).dataProducts.map((o: DataProduct) => o.dataProductId)).toIncludeSameMembers([
      'another-domain-dp',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should return bad requests for errors', async () => {
    const response = await listDataProductsHandler('some-domain', {
      nextToken: 'invalidnexttoken',
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid nextToken');
  });

  it('should list only data products that the caller is allowed to access', async () => {
    API.getGovernancePolicyDomainDataProduct.mockImplementation(({ domainId, dataProductId }) =>
      Promise.resolve({
        domainId,
        dataProductId,
        permissions: dataProductId.includes('allowed')
          ? {
              analyst: {
                access: DataProductAccess.READ_ONLY,
              },
            }
          : {},
      } as any),
    );

    await Promise.all([
      putGeneratedDataProduct('some-domain', 'allowed-1'),
      putGeneratedDataProduct('some-domain', 'denied-1'),
      putGeneratedDataProduct('some-domain', 'allowed-2'),
      putGeneratedDataProduct('some-domain', 'allowed-3'),
      putGeneratedDataProduct('some-domain', 'denied-2'),
    ]);

    const response = await listDataProductsHandler('some-domain');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).dataProducts.map((o: DataProduct) => o.dataProductId)).toIncludeSameMembers([
      'allowed-1',
      'allowed-2',
      'allowed-3',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });
});
