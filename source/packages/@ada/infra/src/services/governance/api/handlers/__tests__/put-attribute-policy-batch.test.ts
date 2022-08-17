/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy, CreateAndUpdateDetails } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { entityIdentifier } from '@ada/api/client/types';
import { handler } from '../put-attribute-policy-batch';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

// Mock the policy store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

const POLICY_1: AttributePolicy = {
  namespaceAndAttributeId: 'default.name',
  group: 'group1',
  lensId: 'hashed',
};

const POLICY_2: AttributePolicy = {
  namespaceAndAttributeId: 'default.name',
  group: 'group2',
  lensId: 'hashed',
};

const POLICY_3: AttributePolicy = {
  namespaceAndAttributeId: 'default.age',
  group: 'group1',
  lensId: 'hidden',
};

describe('put-attribute-policy-batch', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    localDynamoLockClient();

    relationshipClient = localDynamoRelationshipClient();

    API.getOntology.mockResolvedValue({});
    API.getIdentityGroup.mockResolvedValue({});
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putAttributePolicyBatch = (policies: AttributePolicy[]): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        body: JSON.stringify({ policies }),
      }),
      null,
    );

  it('should create and update multiple attribute policies', async () => {
    const response = await putAttributePolicyBatch([POLICY_1, POLICY_2]);
    expect(response.statusCode).toBe(200);

    const writtenPolicies = JSON.parse(response.body).policies as AttributePolicy[] & CreateAndUpdateDetails[];
    expect(writtenPolicies).toHaveLength(2);
    expect(writtenPolicies[0]).toEqual(
      expect.objectContaining({
        ...POLICY_1,
      }),
    );
    expect(writtenPolicies[1]).toEqual(
      expect.objectContaining({
        ...POLICY_2,
      }),
    );

    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributesGroup', POLICY_1)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_1.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributesGroup', POLICY_2)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_2.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(
        entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      ),
    ).toIncludeSameMembers([
      entityIdentifier('GovernancePolicyAttributesGroup', POLICY_1),
      entityIdentifier('GovernancePolicyAttributesGroup', POLICY_2),
    ]);

    // policy2 = update, policy3 = new
    const writtenPolicy2 = writtenPolicies[1];
    const updateResponse = await putAttributePolicyBatch([{ ...writtenPolicy2 }, { ...POLICY_3 }]);
    expect(updateResponse.statusCode).toBe(200);

    const updatedPolicies = JSON.parse(updateResponse.body).policies as AttributePolicy[];
    expect(updatedPolicies).toHaveLength(2);
    expect(updatedPolicies[0]).toEqual(
      expect.objectContaining({
        ...POLICY_2,
      }),
    );
    expect(updatedPolicies[1]).toEqual(
      expect.objectContaining({
        ...POLICY_3,
      }),
    );

    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributesGroup', POLICY_1)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_1.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributesGroup', POLICY_2)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_2.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributesGroup', POLICY_3)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'age' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_3.group }),
    ]);
  });
});
