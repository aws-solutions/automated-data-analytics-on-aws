/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { ApiAccessPolicy } from '@ada/api';
import { ApiAccessPolicyStore } from '../../../../components/ddb/api-access-policy';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-policies';

// Mock the store to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('list-policies', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const listApiAccessPoliciesHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putGeneratedApiAccessPolicy = (apiAccessPolicyId: string) =>
    testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', {
      name: 'test name',
      description: 'test description',
      resources: [],
    });

  it('should list api access policies', async () => {
    let response = await listApiAccessPoliciesHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await Promise.all([
      putGeneratedApiAccessPolicy('list-policies-test-1'),
      putGeneratedApiAccessPolicy('list-policies-test-2'),
      putGeneratedApiAccessPolicy('list-policies-test-3'),
      putGeneratedApiAccessPolicy('list-policies-test-4'),
    ]);

    response = await listApiAccessPoliciesHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies.map((p: ApiAccessPolicy) => p.apiAccessPolicyId)).toIncludeSameMembers([
      'list-policies-test-1',
      'list-policies-test-2',
      'list-policies-test-3',
      'list-policies-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });
  it('should return bad requests for errors', async () => {
    testApiAccessPolicyStore.listApiAccessPolicies = jest.fn().mockReturnValue({ error: 'bad policy' });
    const response = await listApiAccessPoliciesHandler();
    expect(testApiAccessPolicyStore.listApiAccessPolicies).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({ name: 'Error', message: 'bad policy', errorId: expect.stringMatching(/\w{10}/) });
  });
});
