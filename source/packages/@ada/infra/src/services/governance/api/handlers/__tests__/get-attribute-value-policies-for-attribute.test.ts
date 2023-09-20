/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildUniqOntology } from '@ada/common';
import { handler } from '../get-attribute-value-policies-for-attribute';

// Mock the store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('get-attribute-value-policies-for-attribute', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getAttributeValuePoliciesHandler = (
    ontologyNamespace: string,
    attributeId: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { attributeId, ontologyNamespace },
      }),
      null,
    );

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

  const policy1 = {
    group: 'jedi',
    namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
    sqlClause: 'ontologyNamespace.death-star-plans == "no"',
  };

  const policy2 = {
    group: 'sith',
    namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
    sqlClause: 'ontologyNamespace.death-star-plans != "secret"',
  }

  const policy3 = {
    group: 'jedi',
    namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
    sqlClause: 'ontologyNamespace.rebel-base-location < 3',
  }

  const policy4 = {
    group: 'sith',
    namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
    sqlClause: 'ontologyNamespace.rebel-base-location < 1',
  }

  it('should get the attribute value policies for the given group and attributes', async () => {
    await Promise.all([
      putPolicy(policy1),
      putPolicy(policy2),
      putPolicy(policy3),
      putPolicy(policy4),
    ]);

    let response = await getAttributeValuePoliciesHandler(
      'ontologyNamespace',
      'death-star-plans',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).policies).toHaveLength(2);
    expect(JSON.parse(response.body)).toEqual({
      policies: expect.arrayContaining([
        expect.objectContaining(policy1),
        expect.objectContaining(policy2)
      ]),
    });
  });
});
