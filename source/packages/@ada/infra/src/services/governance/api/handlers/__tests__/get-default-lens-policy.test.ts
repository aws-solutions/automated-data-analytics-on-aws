/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DefaultLensPolicy } from '@ada/api';
import { DefaultLensPolicyStore } from '../../components/ddb/default-lens-policy-store';
import { LensIds } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-default-lens-policy';

// Mock the domain store to point to our local dynamodb
const testDefaultLensPolicyStore = new (DefaultLensPolicyStore as any)(getLocalDynamoDocumentClient());
DefaultLensPolicyStore.getInstance = jest.fn(() => testDefaultLensPolicyStore);

describe('get-default-lens-policy', () => {
  const domainId = 'domain';
  const dataProductId = 'data-product';

  const policy: DefaultLensPolicy = {
    domainId,
    dataProductId,
    defaultLensId: LensIds.HIDDEN,
    defaultLensOverrides: {
      group: LensIds.CLEAR,
    },
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await testDefaultLensPolicyStore.putDefaultLensPolicy(domainId, dataProductId, 'test-user', policy);
  });

  // Helper method for calling the handler
  const getDefaultLensPolicyHandler = (domainId: string, dataProductId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId, dataProductId },
      }),
      null,
    );

  it('should get a default lens policy', async () => {
    const response = await getDefaultLensPolicyHandler(domainId, dataProductId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));
  });

  it('should return 404 if no default lens policy is found', async () => {
    let response = await getDefaultLensPolicyHandler('does-not-exist', dataProductId);
    expect(response.statusCode).toBe(404);

    response = await getDefaultLensPolicyHandler(domainId, 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
