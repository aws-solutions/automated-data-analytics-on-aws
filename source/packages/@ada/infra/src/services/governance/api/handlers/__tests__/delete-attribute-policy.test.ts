/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqOntology } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../delete-attribute-policy';

// Mock the store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('delete-attribute-policy', () => {
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
  const deleteAttributePolicyHandler = (
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
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeDefined();

    const response = await deleteAttributePolicyHandler('ontologyNamespace', 'death-star-plans', 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        lensId: LensIds.HASHED,
      }),
    );

    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'jedi'),
    ).toBeUndefined();
    expect(
      await testAttributePolicyStore.getAttributePolicy('ontologyNamespace', 'death-star-plans', 'sith'),
    ).toBeDefined();
  });

  it('should return 404 when attempting to delete a policy that does not exist', async () => {
    let response = await deleteAttributePolicyHandler('ontologyNamespace', 'does-not-exist', 'jedi');
    expect(response.statusCode).toBe(404);

    response = await deleteAttributePolicyHandler('ontologyNamespace', 'death-star-plans', 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
