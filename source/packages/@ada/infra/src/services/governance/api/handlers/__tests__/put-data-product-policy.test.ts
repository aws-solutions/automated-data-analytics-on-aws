/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess } from '@ada/common';
import { CreateAndUpdateDetails, DataProductPolicy } from '@ada/api';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-data-product-policy';

jest.mock('@ada/api-client-lambda');

// Mock the policy store to point to our local dynamodb
const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

describe('put-data-product-policy', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const dataProductId = 'myDataProductId';
  const domainId = 'domain';
  const createUpdateDetails = {
    createdBy: 'test-user',
    updatedBy: 'test-user',
    createdTimestamp: now,
    updatedTimestamp: now,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    API.getDataProductDomainDataProduct.mockResolvedValue(DEFAULT_S3_SOURCE_DATA_PRODUCT);
    API.getIdentityGroup.mockResolvedValue({});
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putDataProductPolicyHandler = (
    domainId: string,
    dataProductId: string,
    dataProductPolicy: DataProductPolicy & CreateAndUpdateDetails,
    callingUser: CallingUser,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { domainId, dataProductId },
        body: dataProductPolicy,
      }) as any,
      null,
    );

  it('should create and update a data product policy', async () => {
    const dataProductPolicy: DataProductPolicy = {
      domainId,
      dataProductId,
      permissions: {
        admin: { access: DataProductAccess.FULL },
      },
    };
    // Create our new data product policy
    const response = await putDataProductPolicyHandler(domainId, dataProductId, dataProductPolicy, {
      userId: 'test-user',
      username: 'test-user@usr.example.com',
      groups: ['admin'],
    });
    expect(response.statusCode).toBe(200);

    const expectedPolicy = {
      ...dataProductPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPolicy);

    // Check the dataProductPolicy is written to dynamodb
    expect(await testDataProductPolicyStore.getDataProductPolicy(domainId, dataProductId)).toEqual(expectedPolicy);

    // Create new policy to be updated
    const updatedPolicy: DataProductPolicy & CreateAndUpdateDetails = {
      domainId,
      dataProductId,
      permissions: {
        admin: { access: DataProductAccess.FULL },
        sales: { access: DataProductAccess.READ_ONLY },
      },
      updatedTimestamp: now,
    };

    const updateResponse = await putDataProductPolicyHandler(domainId, dataProductId, updatedPolicy, {
      userId: 'test-user',
      username: 'test-user@usr.example.com',
      groups: ['admin'],
    });
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedPolicy = {
      ...updatedPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(updateResponse.body)).toStrictEqual(expectedUpdatedPolicy);

    // Try updating as a user without full permmissions
    const forbiddenResponse = await putDataProductPolicyHandler(domainId, dataProductId, updatedPolicy, {
      userId: 'lukeskywalker',
      username: 'lukeskywalker@usr.example.com',
      groups: ['sales'],
    });
    expect(forbiddenResponse.statusCode).toBe(403);

    // Try "locking" ourselves out by specifying no permissions
    let lockoutResponse = await putDataProductPolicyHandler(
      domainId,
      dataProductId,
      {
        domainId,
        dataProductId,
        permissions: {},
        updatedTimestamp: now,
      },
      { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['admin'] },
    );
    expect(lockoutResponse.statusCode).toBe(200);

    // Check we're not actually locked out - we get a 200 again not a 403 as we're the creator
    lockoutResponse = await putDataProductPolicyHandler(
      domainId,
      dataProductId,
      {
        domainId,
        dataProductId,
        permissions: {},
        updatedTimestamp: now,
      },
      { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['admin'] },
    );
    expect(lockoutResponse.statusCode).toBe(200);
  });
});
