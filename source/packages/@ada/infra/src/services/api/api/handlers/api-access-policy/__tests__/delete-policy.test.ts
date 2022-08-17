/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiAccessPolicy } from '@ada/api';
import { ApiAccessPolicyStore } from '../../../../components/ddb/api-access-policy';
import { CallingUser, DefaultApiAccessPolicyIds, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { IRelationshipClient } from '../../../../components/entity/relationships/client';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { handler } from '../delete-policy';
import { localDynamoLockClient } from '../../../../components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../components/entity/relationships/mock';

// Mock the store to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('delete-policy', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
  });

  // Helper method for calling the handler
  const deleteApiAccessPolicyHandler = (
    apiAccessPolicyId: string,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { apiAccessPolicyId },
      }) as any,
      null,
    );

  it.each(Object.values(DefaultApiAccessPolicyIds))(
    'should forbid deletion of built in policy %s',
    async (apiAccessPolicyId) => {
      expect((await deleteApiAccessPolicyHandler(apiAccessPolicyId)).statusCode).toBe(403);
    },
  );

  it('should return 404 when the api access policy does not exist', async () => {
    expect((await deleteApiAccessPolicyHandler('does-not-exist')).statusCode).toBe(404);
  });

  it('should not allow deletion of policies that are still referenced by groups', async () => {
    const apiAccessPolicyId = 'my-policy';
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('ApiAccessPolicy', { apiAccessPolicyId }),
      [entityIdentifier('IdentityGroup', { groupId: 'some-group' })],
    );

    const response = await deleteApiAccessPolicyHandler(apiAccessPolicyId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('some-group');
  });

  it('should delete an api access policy', async () => {
    const apiAccessPolicyId = 'my-policy';
    const policy: ApiAccessPolicy = {
      apiAccessPolicyId,
      name: 'My policy',
      resources: ['some-resource'],
    };
    await testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', policy);

    const response = await deleteApiAccessPolicyHandler(apiAccessPolicyId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));
  });

  it('should NOT delete an api access policy if the user is not an admin', async () => {
    const apiAccessPolicyId = 'my-policy';
    const policy: ApiAccessPolicy = {
      apiAccessPolicyId,
      name: 'My policy',
      resources: ['some-resource'],
    };
    await testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', policy);

    const response = await deleteApiAccessPolicyHandler(apiAccessPolicyId, {
      groups: [DefaultGroupIds.DEFAULT],
      userId: 'different-user',
      username: 'any',
    });
    expect(response.statusCode).toBe(403);
  });
});
