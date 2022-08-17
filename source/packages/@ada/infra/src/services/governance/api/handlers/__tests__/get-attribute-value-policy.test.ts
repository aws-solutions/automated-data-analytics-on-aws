/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { buildUniqAttribute } from '@ada/common';
import { handler } from '../get-attribute-value-policy';

// Mock the store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('get-attribute-value-policy', () => {
  const namespaceAndAttributeId = 'ontologyNamespace.email';
  const group = 'admin';

  const policy: AttributeValuePolicy = {
    namespaceAndAttributeId,
    group,
    sqlClause: 'email LIKE "%@amazon.com"',
  };

  const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await testAttributeValuePolicyStore.putAttributeValuePolicy(
      ontologyNamespace,
      attributeId,
      group,
      'test-user',
      policy,
    );
  });

  // Helper method for calling the handler
  const getAttributeValuePolicyHandler = (
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

  it('should get an attribute value policy', async () => {
    const response = await getAttributeValuePolicyHandler(ontologyNamespace, attributeId, group);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));
  });

  it('should return empty policy if no attribute value policy is found', async () => {
    let response = await getAttributeValuePolicyHandler('ontologyNamespace', 'does-not-exist', group);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining({}));

    response = await getAttributeValuePolicyHandler('ontologyNamespace', attributeId, 'does-not-exist');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining({}));
  });
});
