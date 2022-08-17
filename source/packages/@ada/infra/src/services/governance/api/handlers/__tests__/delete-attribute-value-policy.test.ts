/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildUniqOntology } from '@ada/common';
import { handler } from '../delete-attribute-value-policy';

// Mock the store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('delete-attribute-value-policy', () => {
  const putPolicy = (policy: AttributeValuePolicy) => {
    const { ontologyNamespace, ontologyId } = buildUniqOntology(policy.namespaceAndAttributeId);
    return testAttributeValuePolicyStore.putAttributeValuePolicy(
      ontologyNamespace,
      ontologyId,
      policy.group,
      'test-user',
      policy,
    );
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await Promise.all([
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'death-star-plans == "no"',
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'death-star-plans != "secret"',
      }),
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: 'rebel-base-location < 3',
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: 'rebel-base-location < 1',
      }),
    ]);
  });

  // Helper method for calling the handler
  const deleteAttributeValuePolicyHandler = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { ontologyNamespace, attributeId, group },
      }),
      null,
    );

  it('should delete a policy that exists', async () => {
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();

    const response = await deleteAttributeValuePolicyHandler('ontologyNamespace', 'death-star-plans', 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'death-star-plans == "no"',
      }),
    );

    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();
  });

  it('should return 404 when attempting to delete a policy that does not exist', async () => {
    let response = await deleteAttributeValuePolicyHandler('ontologyNamespace', 'does-not-exist', 'jedi');
    expect(response.statusCode).toBe(404);

    response = await deleteAttributeValuePolicyHandler('ontologyNamespace', 'death-star-plans', 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
