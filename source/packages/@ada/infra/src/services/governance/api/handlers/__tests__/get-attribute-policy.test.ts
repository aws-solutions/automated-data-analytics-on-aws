/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqAttribute } from '@ada/common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-attribute-policy';

// Mock the store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('get-attribute-policy', () => {
  const namespaceAndAttributeId = 'ontologyNamespace.email';
  const group = 'admin';

  const policy: AttributePolicy = {
    namespaceAndAttributeId,
    group,
    lensId: LensIds.HIDDEN,
  };

  const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    await testAttributePolicyStore.putAttributePolicy(ontologyNamespace, attributeId, group, 'test-user', policy);
  });

  // Helper method for calling the handler
  const getAttributePolicyHandler = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { attributeId, ontologyNamespace, group },
      }),
      null,
    );

  it('should get an attribute policy', async () => {
    const response = await getAttributePolicyHandler(ontologyNamespace, attributeId, group);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));
  });

  it('should return 404 if no attribute policy is found', async () => {
    let response = await getAttributePolicyHandler('ontologyNamespace', 'does-not-exist', group);
    expect(response.statusCode).toBe(404);

    response = await getAttributePolicyHandler('ontologyNamespace', attributeId, 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
