/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AttributePolicy } from '@ada/api';
import { AttributePolicyStore } from '../../components/ddb/attribute-policy-store';
import { LensIds, buildUniqAttribute } from '@ada/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../put-attribute-policy';

jest.mock('@ada/api-client-lambda');

// Mock the policy store to point to our local dynamodb
const testAttributePolicyStore = new (AttributePolicyStore as any)(getLocalDynamoDocumentClient());
AttributePolicyStore.getInstance = jest.fn(() => testAttributePolicyStore);

describe('put-attribute-policy', () => {
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
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putAttributePolicyHandler = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
    attributePolicy: AttributePolicy,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { ontologyNamespace, attributeId, group },
        body: JSON.stringify(attributePolicy),
      }),
      null,
    );

  it('should create and update an attribute policy', async () => {
    const attributePolicy: AttributePolicy = {
      namespaceAndAttributeId,
      group,
      lensId: LensIds.HIDDEN,
    };
    // Create our new attribute policy
    const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId!);
    const response = await putAttributePolicyHandler(ontologyNamespace, attributeId, group, attributePolicy);
    expect(response.statusCode).toBe(200);

    const expectedPolicy = {
      ...attributePolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(response.body)).toStrictEqual(expectedPolicy);

    // Check the attribute policy is written to dynamodb
    const updatedAttributePolicy = await testAttributePolicyStore.getAttributePolicy(
      ontologyNamespace,
      attributeId,
      group,
    );
    expect(updatedAttributePolicy).toEqual(expectedPolicy);

    // Create new policy to be updated
    const updatedPolicy: AttributePolicy = {
      ...createUpdateDetails,
      namespaceAndAttributeId,
      group,
      lensId: LensIds.REDACT_PII,
    };
    const updateResponse = await putAttributePolicyHandler(ontologyNamespace, attributeId, group, updatedPolicy);
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedPolicy = {
      ...updatedPolicy,
      ...createUpdateDetails,
    };
    expect(JSON.parse(updateResponse.body)).toStrictEqual(expectedUpdatedPolicy);
  });
});
