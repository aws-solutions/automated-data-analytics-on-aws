/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DomainStore } from '../../../components/ddb/domain';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-domain';

// Mock the domain store to point to our local dynamodb
const testDomainStore = new (DomainStore as any)(getLocalDynamoDocumentClient());
DomainStore.getInstance = jest.fn(() => testDomainStore);

describe('get-domain', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getDomainHandler = (domainId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId },
      }),
      null,
    );

  it('should return a domain if the domainId exists', async () => {
    const domain = {
      name: 'test name',
      description: 'test description',
    };

    // Create our new domain
    await testDomainStore.putDomain('domain-id', 'test-user', domain);

    const response = await getDomainHandler('domain-id');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...domain,
        domainId: 'domain-id',
      }),
    );
  });

  it('should return 404 if domain does not exist', async () => {
    const response = await getDomainHandler('domain-id-does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('domain-id-does-not-exist');
  });
});
