/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy, AttributePolicyIdentifier } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { buildUniqOntology } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../delete-attribute-value-policy-batch';

// Mock the store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('delete-attribute-value-policy-batch', () => {
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
        sqlClause: 'death-star-plans > 0',
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'death-star-plans < 0',
      }),
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: "rebel-base-location = 'a'",
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: "rebel-base-location = 'b'",
      }),
    ]);
  });

  // Helper method for calling the handler
  const deleteAttributeValuePolicyBatchHandler = (policies: AttributePolicyIdentifier[]): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        body: JSON.stringify({ policies }),
      }),
      null,
    );

  it('should delete multiple attribute policies', async () => {
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();

    const response = await deleteAttributeValuePolicyBatchHandler([
      { group: 'jedi', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
      { group: 'sith', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
    ]);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(2);

    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeUndefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'rebel-base-location', 'sith'),
    ).toBeDefined();
  });

  it('should skip missing attribute policies', async () => {
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();

    const response = await deleteAttributeValuePolicyBatchHandler([
      { group: 'jedi', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
      { group: 'sith', namespaceAndAttributeId: 'ontologyNamespace.does-not-exist' },
    ]);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(1);

    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();
    expect(
      await testAttributeValuePolicyStore.getAttributeValuePolicy('ontologyNamespace', 'rebel-base-location', 'sith'),
    ).toBeDefined();
  });
});
