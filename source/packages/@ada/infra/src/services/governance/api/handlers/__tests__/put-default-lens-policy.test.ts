/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess, LensIds } from '@ada/common';
import { CreateAndUpdateDetails, DataProductPolicy, DefaultLensPolicy } from '@ada/api';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { DefaultLensPolicyStore } from '../../components/ddb/default-lens-policy-store';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-default-lens-policy';

jest.mock('@ada/api-client-lambda');

const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

// Mock the policy store to point to our local dynamodb
const testDefaultLensPolicyStore = new (DefaultLensPolicyStore as any)(getLocalDynamoDocumentClient());
DefaultLensPolicyStore.getInstance = jest.fn(() => testDefaultLensPolicyStore);

describe('put-default-lens-policy', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const domainId = 'domain';
  const dataProductId = 'data-product';
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

  const putDataProductPolicyPolicy = (policy: DataProductPolicy) => {
    const { domainId, dataProductId } = policy;
    return testDataProductPolicyStore.putDataProductPolicy(domainId, dataProductId, DEFAULT_CALLER.userId, policy);
  };

  // Helper method for calling the handler
  const putDefaultLensPolicyHandler = (
    domainId: string,
    dataProductId: string,
    defaultLensPolicy: DefaultLensPolicy,
    caller: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(caller, {
        pathParameters: { domainId, dataProductId },
        body: defaultLensPolicy,
      }) as any,
      null,
    );

  it('should create and update a default lens policy', async () => {
    const defaultLensPolicy: DefaultLensPolicy = {
      domainId,
      dataProductId,
      defaultLensId: LensIds.REDACT_PII,
      defaultLensOverrides: {
        sith: LensIds.CLEAR,
      },
    };

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
    // Create our new attribute policy
    const response = await putDefaultLensPolicyHandler(domainId, dataProductId, defaultLensPolicy);
    expect(response.statusCode).toBe(200);

    const expectedPolicy = {
      ...defaultLensPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPolicy);

    // Check the attribute policy is written to dynamodb
    expect(await testDefaultLensPolicyStore.getDefaultLensPolicy(domainId, dataProductId)).toEqual(expectedPolicy);

    // Create new policy to be updated
    const updatedPolicy: DefaultLensPolicy & CreateAndUpdateDetails = {
      domainId,
      dataProductId,
      defaultLensId: LensIds.CLEAR,
      defaultLensOverrides: {
        sith: LensIds.CLEAR,
        jedi: LensIds.REDACT_PII,
      },
      updatedTimestamp: now,
    };
    const updateResponse = await putDefaultLensPolicyHandler(domainId, dataProductId, updatedPolicy);
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedPolicy = {
      ...updatedPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(updateResponse.body)).toStrictEqual(expectedUpdatedPolicy);
  });

  it('should not create a default lens policy if the user is does not have access to the data product', async () => {
    const defaultLensPolicy: DefaultLensPolicy = {
      domainId,
      dataProductId,
      defaultLensId: LensIds.REDACT_PII,
      defaultLensOverrides: {
        sith: LensIds.CLEAR,
      },
    };

    await putDataProductPolicyPolicy({
      domainId,
      dataProductId,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        analyst: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    });
    // Create our new attribute policy
    const response = await putDefaultLensPolicyHandler(domainId, dataProductId, defaultLensPolicy, {
      groups: ['analyst'],
      // use another user id that did not create the original data product
      userId: 'another-user',
      username: 'another-user@usr.example.com',
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Not authorized to delete default lens policy for data product domain.data-product',
        name: 'Error',
      }),
    );
  });
});
