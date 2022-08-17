/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import * as _ from 'lodash';
import { MOCK_API_CLIENT as API, entityIdentifier } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../delete-group';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

describe('delete-group', () => {
  let relationshipClient: IRelationshipClient;

  const groupId = 'group-id';
  const apiAccessPolicyIds = ['administer-permissions', 'read', 'administer-identity'];
  const group = {
    groupId,
    description: 'The administrator group',
    claims: ['claim-1', 'claim-2', 'claim-3'],
    members: ['member-1', 'member-2', 'member-3'],
    apiAccessPolicyIds,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
  });

  // Helper method for calling the handler
  const deleteGroupHandler = (
    groupId: string,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { groupId },
      }) as any,
      null,
    );

  it.each(Object.values(DefaultGroupIds))('should forbid deletion of built in group %s', async (groupId) => {
    expect((await deleteGroupHandler(groupId)).statusCode).toBe(403);
  });

  it('should not allow deleting a group that exists in a data product default lens override', async () => {
    await relationshipClient.addRelationships(DEFAULT_CALLER, entityIdentifier('IdentityGroup', { groupId }), [
      entityIdentifier('GovernancePolicyDefaultLensDomainDataProduct', {
        domainId: 'domain',
        dataProductId: 'data-product',
      }),
    ]);

    const response = await deleteGroupHandler(groupId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('domain.data-product');
  });

  it('should not allow deleting a group that exists in a data product policy', async () => {
    await relationshipClient.addRelationships(DEFAULT_CALLER, entityIdentifier('IdentityGroup', { groupId }), [
      entityIdentifier('GovernancePolicyDomainDataProduct', { domainId: 'domain', dataProductId: 'data-product' }),
    ]);

    const response = await deleteGroupHandler(groupId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('domain.data-product');
  });

  it('should return 404 if the group does not exist', async () => {
    expect((await deleteGroupHandler(groupId)).statusCode).toBe(404);
  });

  it.each(['group-creator', DefaultGroupIds.ADMIN])(
    'should allow %s to delete a group and its corresponding attribute and attribute value policies',
    async (deletingUserId) => {
      await testGroupStore.putGroup(groupId, 'group-creator', group);

      await relationshipClient.addRelationships(DEFAULT_CALLER, entityIdentifier('IdentityGroup', { groupId }), [
        entityIdentifier('GovernancePolicyAttributesGroup', {
          group: groupId,
          namespaceAndAttributeId: 'some.ontology',
        }),
        entityIdentifier('GovernancePolicyAttributeValuesGroup', {
          group: groupId,
          namespaceAndAttributeId: 'another.ontology',
        }),
      ]);

      API.deleteGovernancePolicyAttributesGroup.mockResolvedValue({});
      API.deleteGovernancePolicyAttributeValuesGroup.mockResolvedValue({});

      const response = await deleteGroupHandler(groupId, {
        ...DEFAULT_CALLER,
        userId: deletingUserId,
        groups: [deletingUserId],
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(expect.objectContaining(group));

      expect(API.deleteGovernancePolicyAttributesGroup).toHaveBeenCalledWith({
        group: groupId,
        ontologyNamespace: 'some',
        attributeId: 'ontology',
      });
      expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledWith({
        group: groupId,
        ontologyNamespace: 'another',
        attributeId: 'ontology',
      });
    },
  );

  it('should forbid deletion of a group by a non group owner', async () => {
    await testGroupStore.putGroup(groupId, 'group-creator', group);
    expect(
      (
        await deleteGroupHandler(groupId, {
          ...DEFAULT_CALLER,
          userId: 'unauthorized-user',
          groups: ['analyst'],
        })
      ).statusCode,
    ).toBe(403);
  });
});
