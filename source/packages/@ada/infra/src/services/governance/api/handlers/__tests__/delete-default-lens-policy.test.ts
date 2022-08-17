/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess, LensIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { DataProductPolicy, DefaultLensPolicy } from '@ada/api';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { DefaultLensPolicyStore } from '../../components/ddb/default-lens-policy-store';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../delete-default-lens-policy';

// Mock the domain store to point to our local dynamodb
const testDefaultLensPolicyStore = new (DefaultLensPolicyStore as any)(getLocalDynamoDocumentClient());
DefaultLensPolicyStore.getInstance = jest.fn(() => testDefaultLensPolicyStore);

const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

describe('delete-default-lens-policy', () => {
  const putPolicy = (policy: DefaultLensPolicy) =>
    testDefaultLensPolicyStore.putDefaultLensPolicy(policy.domainId, policy.dataProductId, 'test-user', policy);

  const putDataProductPolicyPolicy = (policy: DataProductPolicy) => {
    const { domainId, dataProductId } = policy;
    return testDataProductPolicyStore.putDataProductPolicy(domainId, dataProductId, 'test-user', policy);
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await Promise.all([
      putPolicy({
        domainId: 'domain',
        dataProductId: 'data-product-1',
        defaultLensId: LensIds.HASHED,
        defaultLensOverrides: {},
      }),
      putPolicy({
        domainId: 'domain',
        dataProductId: 'data-product-2',
        defaultLensId: LensIds.CLEAR,
        defaultLensOverrides: { sith: LensIds.HIDDEN },
      }),
    ]);
  });

  // Helper method for calling the handler
  const deleteDefaultLensPolicyHandler = (
    domainId: string,
    dataProductId: string,
    caller: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(caller, {
        pathParameters: { domainId, dataProductId },
      }) as any,
      null,
    );

  it('should delete a policy that exists', async () => {
    const domainId = 'domain';
    const dataProductId = 'data-product-1';

    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, dataProductId)).toBeDefined();
    await putDataProductPolicyPolicy({
      domainId,
      dataProductId,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        default: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });

    const response = await deleteDefaultLensPolicyHandler(domainId, dataProductId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        domainId: domainId,
        dataProductId,
        defaultLensId: LensIds.HASHED,
        defaultLensOverrides: {},
      }),
    );

    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, dataProductId)).toBeUndefined();
    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, 'data-product-2')).toBeDefined();
  });

  it('should not delete a policy if the user has no access to the data product', async () => {
    const domainId = 'domain';
    const dataProductId = 'data-product-1';

    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, dataProductId)).toBeDefined();
    await putDataProductPolicyPolicy({
      domainId,
      dataProductId,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        default: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });

    const response = await deleteDefaultLensPolicyHandler(domainId, dataProductId, {
      groups: ['analyst'],
      // use another user id that did not create the original data product
      userId: 'another-user',
      username: 'another-user@usr.example.com',
    });
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Not authorized to delete default lens policy for data product domain.data-product-1',
        name: 'Error',
      }),
    );

    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, dataProductId)).toBeDefined();
    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, 'data-product-2')).toBeDefined();
  });

  it('should return 404 when attempting to delete a policy that does not exist', async () => {
    let response = await deleteDefaultLensPolicyHandler('does-not-exist', 'data-product-1');
    expect(response.statusCode).toBe(404);

    response = await deleteDefaultLensPolicyHandler('domain', 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
