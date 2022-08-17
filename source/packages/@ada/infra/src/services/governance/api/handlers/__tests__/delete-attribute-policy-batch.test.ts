/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy, AttributePolicyIdentifier } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqOntology } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../delete-attribute-policy-batch';

// Mock the store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('delete-attribute-policy-batch', () => {
  const putPolicy = (policy: AttributePolicy) => {
    const { ontologyNamespace, ontologyId } = buildUniqOntology(policy.namespaceAndAttributeId);
    return testAttributePolicyStore.putAttributePolicy(
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
        lensId: LensIds.HASHED,
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        lensId: LensIds.CLEAR,
      }),
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        lensId: LensIds.CLEAR,
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        lensId: LensIds.HIDDEN,
      }),
    ]);
  });

  // Helper method for calling the handler
  const deleteAttributePolicyBatchHandler = (policies: AttributePolicyIdentifier[]): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        body: JSON.stringify({ policies }),
      }),
      null,
    );

  it('should delete multiple attribute policies', async () => {
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();

    const response = await deleteAttributePolicyBatchHandler([
      { group: 'jedi', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
      { group: 'sith', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
    ]);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(2);

    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeUndefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'rebel-base-location', 'sith'),
    ).toBeDefined();
  });

  it('should skip missing attribute policies', async () => {
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();

    const response = await deleteAttributePolicyBatchHandler([
      { group: 'jedi', namespaceAndAttributeId: 'ontologyNamespace.death-star-plans' },
      { group: 'sith', namespaceAndAttributeId: 'ontologyNamespace.does-not-exist' },
    ]);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(1);

    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'rebel-base-location', 'sith'),
    ).toBeDefined();
  });
});
