/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiAccessPolicyStore } from '../../../../components/ddb/api-access-policy';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-policy';

// Mock the store to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('get-policy', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getApiAccessPolicyHandler = (apiAccessPolicyId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { apiAccessPolicyId },
      }),
      null,
    );

  it('should return a policy if the apiAccessPolicyId exists', async () => {
    const policy = {
      name: 'test name',
      description: 'test description',
      resources: ['some-resource', 'another-resource'],
    };

    await testApiAccessPolicyStore.putApiAccessPolicy('policy-id', 'test-user', policy);

    const response = await getApiAccessPolicyHandler('policy-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...policy,
        apiAccessPolicyId: 'policy-id',
      }),
    );
  });

  it('should return 404 if the policy does not exist', async () => {
    const response = await getApiAccessPolicyHandler('policy-id-does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('policy-id-does-not-exist');
  });
});
