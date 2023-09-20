/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqAttribute } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-attribute-policies-for-attribute';

// Mock the store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('get-attribute-policies-for-attribute', () => {
  const namespaceAndAttributeId = 'ontologyNamespace.email';
  const group1 = 'admin';
  const group2 = 'default';

  const policy1: AttributePolicy = {
    namespaceAndAttributeId,
    group: group1,
    lensId: LensIds.HASHED,
  };

  const policy2: AttributePolicy = {
    namespaceAndAttributeId,
    group: group2,
    lensId: LensIds.HIDDEN,
  };

  const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await testAttributePolicyStore.putAttributePolicy(ontologyNamespace, attributeId, group1, 'test-user', policy1);
    await testAttributePolicyStore.putAttributePolicy(ontologyNamespace, attributeId, group2, 'test-user', policy2);
  });

  // Helper method for calling the handler
  const getAttributePoliciesForAttributeHandler = (
    ontologyNamespace: string,
    attributeId: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { attributeId, ontologyNamespace },
      }),
      null,
    );

  it('should get an attribute policy', async () => {
    const response = await getAttributePoliciesForAttributeHandler(ontologyNamespace, attributeId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      policies: [expect.objectContaining(policy1), expect.objectContaining(policy2)]
    });
  });
});
