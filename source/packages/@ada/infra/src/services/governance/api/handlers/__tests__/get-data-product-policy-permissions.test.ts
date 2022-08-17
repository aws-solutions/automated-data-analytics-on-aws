/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateAndUpdateDetails, DataProductPolicy } from '@ada/api';
import { DataProductAccess } from '@ada/common';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-data-product-policy-permissions';

// Mock the domain store to point to our local dynamodb
const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

describe('get-data-product-policy-permissions', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const dataProductId = 'myDataProductId';
  const domainId = 'domain';
  const dataProductPolicy: DataProductPolicy = {
    domainId,
    dataProductId,
    permissions: {
      admin: { access: DataProductAccess.FULL },
      developers: { access: DataProductAccess.READ_ONLY },
    },
  };
  const createUpdateDetails: CreateAndUpdateDetails = {
    createdBy: 'test-user',
    updatedBy: 'test-user',
    createdTimestamp: now,
    updatedTimestamp: now,
  };
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const getDataProductPolicyHandler = (
    domainId: string,
    dataProductId: string,
    groups: string[] | undefined,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId, dataProductId },
        multiValueQueryStringParameters: { groups },
      }),
      null,
    );

  it('should get the permissions of a data product policy', async () => {
    testDataProductPolicyStore.getDataProductPolicy = jest.fn(() =>
      createMockPolicy(dataProductPolicy, createUpdateDetails),
    );
    let groups = ['admin'];
    // Get permissions of data product policy with one group defined
    let response = await getDataProductPolicyHandler(domainId, dataProductId, groups);
    expect(response.statusCode).toBe(200);

    const expectedPermissions = {
      admin: { access: DataProductAccess.FULL },
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPermissions);

    groups = ['admin', 'developers'];
    // Get permissions of data product policy with multi groups defined
    response = await getDataProductPolicyHandler(domainId, dataProductId, groups);
    expect(response.statusCode).toBe(200);

    const expectedPermissionsMultiGroup = {
      ...dataProductPolicy.permissions,
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPermissionsMultiGroup);
  });

  it.each([['nomatch', 'none'], undefined, [], ['']])('should return {} if groups is %s', async (groups) => {
    testDataProductPolicyStore.getDataProductPolicy = jest.fn(() =>
      createMockPolicy(dataProductPolicy, createUpdateDetails),
    );

    const response = await getDataProductPolicyHandler(domainId, dataProductId, groups);
    expect(response.statusCode).toBe(200);

    expect(JSON.parse(response.body)).toEqual({});
  });

  it('should return 404 if no data policy product is found', async () => {
    // return undefined if no data policy product is found
    testDataProductPolicyStore.getDataProductPolicy = jest.fn(() => undefined);

    const groups = ['admin', 'developers'];
    const response = await getDataProductPolicyHandler(domainId, dataProductId, groups);
    expect(response.statusCode).toBe(404);

    const expectedResponse = {
      message: `Not Found: data product policy for data product ${domainId}.${dataProductId}`,
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedResponse);
  });
});

// Helper method to return a mock data product policy
const createMockPolicy = (dataProductPolicy: DataProductPolicy, createUpdateDetails: CreateAndUpdateDetails) => {
  const mockPolicy = {
    ...dataProductPolicy,
    ...createUpdateDetails,
  };

  return mockPolicy;
};
