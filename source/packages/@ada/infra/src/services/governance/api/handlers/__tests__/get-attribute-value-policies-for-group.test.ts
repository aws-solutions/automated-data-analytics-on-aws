/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildUniqOntology } from '@ada/common';
import { handler } from '../get-attribute-value-policies-for-group';

// Mock the store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('get-attribute-value-policies-for-group', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getAttributeValuePoliciesHandler = (
    namespaceAndAttributeIds?: string[],
    group?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters: { group },
        multiValueQueryStringParameters: { namespaceAndAttributeIds },
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

  it('should get the attribute value policies for the given group and attributes', async () => {
    await Promise.all([
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'ontologyNamespace.death-star-plans == "no"',
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.death-star-plans',
        sqlClause: 'ontologyNamespace.death-star-plans != "secret"',
      }),
      putPolicy({
        group: 'jedi',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: 'ontologyNamespace.rebel-base-location < 3',
      }),
      putPolicy({
        group: 'sith',
        namespaceAndAttributeId: 'ontologyNamespace.rebel-base-location',
        sqlClause: 'ontologyNamespace.rebel-base-location < 1',
      }),
    ]);

    let response = await getAttributeValuePoliciesHandler(
      ['ontologyNamespace.death-star-plans', 'ontologyNamespace.rebel-base-location'],
      'sith',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToSqlClause: {
        'ontologyNamespace.death-star-plans': 'ontologyNamespace.death-star-plans != "secret"',
        'ontologyNamespace.rebel-base-location': 'ontologyNamespace.rebel-base-location < 1',
      },
    });

    response = await getAttributeValuePoliciesHandler(
      ['ontologyNamespace.death-star-plans', 'ontologyNamespace.rebel-base-location'],
      'jedi',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToSqlClause: {
        'ontologyNamespace.death-star-plans': 'ontologyNamespace.death-star-plans == "no"',
        'ontologyNamespace.rebel-base-location': 'ontologyNamespace.rebel-base-location < 3',
      },
    });

    response = await getAttributeValuePoliciesHandler(['ontologyNamespace.death-star-plans'], 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToSqlClause: {
        'ontologyNamespace.death-star-plans': 'ontologyNamespace.death-star-plans == "no"',
      },
    });

    response = await getAttributeValuePoliciesHandler(
      ['ontologyNamespace.death-star-plans', 'ontologyNamespace.rebel-base-location'],
      'empire',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToSqlClause: {} });

    response = await getAttributeValuePoliciesHandler([], 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToSqlClause: {} });

    response = await getAttributeValuePoliciesHandler(undefined, 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToSqlClause: {} });
  });

  it('should return 400 if no group is specified', async () => {
    const response = await getAttributeValuePoliciesHandler(
      ['ontologyNamespace.death-star-plans', 'ontologyNamespace.rebel-base-location'],
      undefined,
    );
    expect(response.statusCode).toBe(400);
  });
});
