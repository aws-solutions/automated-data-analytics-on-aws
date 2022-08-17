/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DataProductAccess } from '@ada/common';
import { DataProductPolicy } from '@ada/api';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-data-product-policy';

// Mock the store to point to our local dynamodb
const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

describe('get-data-product-policy', () => {
  const dataProductId = 'data-product';
  const domainId = 'domain';

  const policy: DataProductPolicy = {
    domainId,
    dataProductId,
    permissions: {
      admins: {
        access: DataProductAccess.FULL,
      },
    },
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await testDataProductPolicyStore.putDataProductPolicy(domainId, dataProductId, 'test-user', policy);
  });

  // Helper method for calling the handler
  const getDataProductPolicyHandler = (domainId: string, dataProductId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId, dataProductId },
      }),
      null,
    );

  it('should get an attribute policy', async () => {
    const response = await getDataProductPolicyHandler(domainId, dataProductId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));
  });

  it('should return 404 if no attribute policy is found', async () => {
    let response = await getDataProductPolicyHandler('does-not-exist', dataProductId);
    expect(response.statusCode).toBe(404);

    response = await getDataProductPolicyHandler(domainId, 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
