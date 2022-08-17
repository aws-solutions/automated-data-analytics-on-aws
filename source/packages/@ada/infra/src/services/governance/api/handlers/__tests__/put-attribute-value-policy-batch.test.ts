/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy, CreateAndUpdateDetails } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { entityIdentifier } from '@ada/api/client/types';
import { handler } from '../put-attribute-value-policy-batch';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

// Mock the policy store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

const POLICY_1: AttributeValuePolicy = {
  namespaceAndAttributeId: 'default.name',
  group: 'group1',
  sqlClause: 'some sql',
};

const POLICY_2: AttributeValuePolicy = {
  namespaceAndAttributeId: 'default.name',
  group: 'group2',
  sqlClause: 'some sql',
};

const POLICY_3: AttributeValuePolicy = {
  namespaceAndAttributeId: 'default.age',
  group: 'group1',
  sqlClause: 'some sql',
};

describe('put-attribute-value-policy-batch', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();

    API.getOntology.mockResolvedValue({});
    API.getIdentityGroup.mockResolvedValue({});
    API.postQueryParseRenderValidateAttributeValuePolicy.mockResolvedValue({});
  });

  // Helper method for calling the handler
  const putAttributeValuePolicyBatch = (policies: AttributeValuePolicy[]): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        body: JSON.stringify({ policies }),
      }),
      null,
    );

  it('should create and update multiple attribute value policies', async () => {
    const response = await putAttributeValuePolicyBatch([POLICY_1, POLICY_2]);
    expect(response.statusCode).toBe(200);

    const writtenPolicies = JSON.parse(response.body).policies as AttributeValuePolicy[] & CreateAndUpdateDetails[];
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
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_1)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_1.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_2)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_2.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(
        entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      ),
    ).toIncludeSameMembers([
      entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_1),
      entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_2),
    ]);

    const writtenPolicy2 = writtenPolicies[1];
    const updateResponse = await putAttributeValuePolicyBatch([{ ...writtenPolicy2 }, POLICY_3]);
    expect(updateResponse.statusCode).toBe(200);

    const updatedPolicies = JSON.parse(updateResponse.body).policies as AttributeValuePolicy[];
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
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_1)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_1.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_2)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'name' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_2.group }),
    ]);
    expect(
      await relationshipClient.getRelatedEntities(entityIdentifier('GovernancePolicyAttributeValuesGroup', POLICY_3)),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: 'default', ontologyId: 'age' }),
      entityIdentifier('IdentityGroup', { groupId: POLICY_3.group }),
    ]);
  });

  it('should fail to write an invalid attribute value policy', async () => {
    API.postQueryParseRenderValidateAttributeValuePolicy.mockRejectedValue(
      apiClientErrorResponse(400, {
        message: 'Invalid!',
      }),
    );
    const response = await putAttributeValuePolicyBatch([POLICY_1, POLICY_2]);
    expect(response.statusCode).toBe(400);
  });
});
