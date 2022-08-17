/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiAccessPolicy } from '@ada/api';
import { ApiAccessPolicyStore } from '../../../../components/ddb/api-access-policy';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../put-policy';

// Mock the store to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('put-policy', () => {
  const before = '2020-01-01T00:00:00.000Z';
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putApiAccessPolicyHandler = (
    apiAccessPolicyId: string,
    policy: Omit<ApiAccessPolicy, 'apiAccessPolicyId'>,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { apiAccessPolicyId },
        body: JSON.stringify(policy),
      }),
      null,
    );

  it('should create and update api access policies', async () => {
    const policy = {
      name: 'test name',
      description: 'test description',
      resources: ['some-resource', 'another-resource'],
    };

    // Create our new policy
    const response = await putApiAccessPolicyHandler('create-update-test-policy-id', policy);
    expect(response.statusCode).toBe(200);

    const expectedApiAccessPolicy = {
      ...policy,
      apiAccessPolicyId: 'create-update-test-policy-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedApiAccessPolicy);

    const updatedApiAccessPolicy = {
      ...policy,
      description: 'new description',
      updatedTimestamp: now,
    };

    // Update the policy
    const updateResponse = await putApiAccessPolicyHandler('create-update-test-policy-id', updatedApiAccessPolicy);
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedApiAccessPolicy = {
      ...updatedApiAccessPolicy,
      apiAccessPolicyId: 'create-update-test-policy-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedApiAccessPolicy);

    // Check the policy is written to dynamodb
    expect(await testApiAccessPolicyStore.getApiAccessPolicy('create-update-test-policy-id')).toEqual(
      expectedUpdatedApiAccessPolicy,
    );
  });

  it('should NOT create api access policy if item with same id exists', async () => {
    const policy = {
      name: 'test name',
      description: 'test description',
      resources: ['some-resource', 'another-resource'],
    };

    // Create our new policy
    const response = await putApiAccessPolicyHandler('create-update-test-policy-id', policy);
    expect(response.statusCode).toBe(200);

    const expectedApiAccessPolicy = {
      ...policy,
      apiAccessPolicyId: 'create-update-test-policy-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedApiAccessPolicy);

    const updatedApiAccessPolicy = {
      ...policy,
      description: 'new description',
    };

    // Update the policy
    const updateResponse = await putApiAccessPolicyHandler('create-update-test-policy-id', updatedApiAccessPolicy);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('Item with same id already exists');
  });

  it('should NOT update api access policy if updatedTimestamp does not match', async () => {
    const policy = {
      name: 'test name',
      description: 'test description',
      resources: ['some-resource', 'another-resource'],
    };

    // Create our new policy
    const response = await putApiAccessPolicyHandler('create-update-test-policy-id', policy);
    expect(response.statusCode).toBe(200);

    const expectedApiAccessPolicy = {
      ...policy,
      apiAccessPolicyId: 'create-update-test-policy-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedApiAccessPolicy);

    const updatedApiAccessPolicy = {
      ...policy,
      description: 'new description',
      updatedTimestamp: before,
    };

    // Update the policy
    const updateResponse = await putApiAccessPolicyHandler('create-update-test-policy-id', updatedApiAccessPolicy);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('cannot be updated');
  });
});
