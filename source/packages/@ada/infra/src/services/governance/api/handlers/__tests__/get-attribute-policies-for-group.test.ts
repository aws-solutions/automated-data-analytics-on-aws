/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqOntology } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-attribute-policies-for-group';

// Mock the store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('get-attribute-policies-for-group', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getAttributePoliciesHandler = (
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

  const putPolicy = (policy: AttributePolicy) => {
    const { ontologyNamespace, ontologyId: attributeId } = buildUniqOntology(policy.namespaceAndAttributeId);
    return testAttributePolicyStore.putAttributePolicy(
      ontologyNamespace,
      attributeId,
      policy.group,
      'test-user',
      policy,
    );
  };
  it('should get the attribute policies for the given group and attributes', async () => {
    await Promise.all([
      putPolicy({ group: 'jedi', namespaceAndAttributeId: 'namespace.death-star-plans', lensId: LensIds.HASHED }),
      putPolicy({ group: 'sith', namespaceAndAttributeId: 'namespace.death-star-plans', lensId: LensIds.CLEAR }),
      putPolicy({ group: 'jedi', namespaceAndAttributeId: 'namespace.rebel-base-location', lensId: LensIds.CLEAR }),
      putPolicy({ group: 'sith', namespaceAndAttributeId: 'namespace.rebel-base-location', lensId: LensIds.HIDDEN }),
    ]);

    let response = await getAttributePoliciesHandler(
      ['namespace.death-star-plans', 'namespace.rebel-base-location'],
      'sith',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToLensId: {
        'namespace.death-star-plans': LensIds.CLEAR,
        'namespace.rebel-base-location': LensIds.HIDDEN,
      },
    });

    response = await getAttributePoliciesHandler(
      ['namespace.death-star-plans', 'namespace.rebel-base-location'],
      'jedi',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToLensId: {
        'namespace.death-star-plans': LensIds.HASHED,
        'namespace.rebel-base-location': LensIds.CLEAR,
      },
    });

    response = await getAttributePoliciesHandler(['namespace.death-star-plans'], 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      attributeIdToLensId: {
        'namespace.death-star-plans': LensIds.HASHED,
      },
    });

    response = await getAttributePoliciesHandler(
      ['namespace.death-star-plans', 'namespace.rebel-base-location'],
      'empire',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToLensId: {} });

    response = await getAttributePoliciesHandler([], 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToLensId: {} });

    response = await getAttributePoliciesHandler(undefined, 'jedi');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ attributeIdToLensId: {} });
  });

  it('should return 400 if no group is specified', async () => {
    const response = await getAttributePoliciesHandler(
      ['namespace.death-star-plans', 'namespace.rebel-base-location'],
      undefined,
    );
    expect(response.statusCode).toBe(400);
  });
});
