/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributeValuePolicy } from '@ada/api';
import { AttributeValuePolicyStore } from '../../components/ddb/attribute-value-policy-store';
import { apiClientErrorResponse } from '@ada/api/client/mock';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { buildUniqAttribute } from '@ada/common';
import { handler } from '../put-attribute-value-policy';

jest.mock('@ada/api-client-lambda');

// Mock the policy store to point to our local dynamodb
const testAttributeValuePolicyStore = new (AttributeValuePolicyStore as any)(getLocalDynamoDocumentClient());
AttributeValuePolicyStore.getInstance = jest.fn(() => testAttributeValuePolicyStore);

describe('put-attribute-value-policy', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const group = 'admin';
  const namespaceAndAttributeId = 'ontologyNamespace.email';
  const createUpdateDetails = {
    createdBy: 'test-user',
    updatedBy: 'test-user',
    createdTimestamp: now,
    updatedTimestamp: now,
  };

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    API.getOntology.mockResolvedValue({});
    API.getIdentityGroup.mockResolvedValue({});
    API.postQueryParseRenderValidateAttributeValuePolicy.mockResolvedValue({});
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putAttributeValuePolicyHandler = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
    attributeValuePolicy: AttributeValuePolicy,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { ontologyNamespace, attributeId, group },
        body: JSON.stringify(attributeValuePolicy),
      }),
      null,
    );

  it('should create and update an attribute value policy', async () => {
    const attributeValuePolicy: AttributeValuePolicy = {
      namespaceAndAttributeId,
      group,
      sqlClause: 'ontologyNamespace.email LIKE "%@amazon.com"',
    };
    // Create our new attribute value policy
    const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);
    const response = await putAttributeValuePolicyHandler(ontologyNamespace, attributeId, group, attributeValuePolicy);
    expect(response.statusCode).toBe(200);

    const expectedPolicy = {
      ...attributeValuePolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPolicy);

    // Check the attribute value policy is written to dynamodb
    expect(await testAttributeValuePolicyStore.getAttributeValuePolicy(ontologyNamespace, attributeId, group)).toEqual(
      expectedPolicy,
    );

    // Create new policy to be updated
    const updatedPolicy: AttributeValuePolicy = {
      namespaceAndAttributeId,
      group,
      sqlClause: 'email LIKE "%@aws.com"',
    };
    const updateResponse = await putAttributeValuePolicyHandler(ontologyNamespace, attributeId, group, {
      ...updatedPolicy,
      ...createUpdateDetails,
    });
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedPolicy = {
      ...updatedPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(updateResponse.body)).toStrictEqual(expectedUpdatedPolicy);
  });

  it('should fail to write an invalid attribute value policy', async () => {
    API.postQueryParseRenderValidateAttributeValuePolicy.mockRejectedValue(
      apiClientErrorResponse(400, {
        message: 'Invalid!',
      }),
    );
    const attributeValuePolicy: AttributeValuePolicy = {
      namespaceAndAttributeId,
      group,
      sqlClause: 'invalid!!',
    };
    // Create our new attribute value policy
    const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);
    const response = await putAttributeValuePolicyHandler(ontologyNamespace, attributeId, group, attributeValuePolicy);
    expect(response.statusCode).toBe(400);
  });
});
