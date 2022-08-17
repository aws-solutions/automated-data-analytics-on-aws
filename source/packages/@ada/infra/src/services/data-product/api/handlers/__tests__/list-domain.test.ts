/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { Domain } from '@ada/api';
import { DomainStore } from '../../../components/ddb/domain';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-domain';

// Mock the domain store to point to our local dynamodb
const testDomainStore = new (DomainStore as any)(getLocalDynamoDocumentClient());
DomainStore.getInstance = jest.fn(() => testDomainStore);

describe('list-domain', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const listDomainsHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putGeneratedDomain = (domainId: string) =>
    testDomainStore.putDomain(domainId, 'test-user', {
      name: 'test name',
      description: 'test description',
    });

  it('should list domains', async () => {
    let response = await listDomainsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).domains).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await Promise.all([
      putGeneratedDomain('list-domains-test-1'),
      putGeneratedDomain('list-domains-test-2'),
      putGeneratedDomain('list-domains-test-3'),
      putGeneratedDomain('list-domains-test-4'),
    ]);

    response = await listDomainsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).domains.map((o: Domain) => o.domainId)).toIncludeSameMembers([
      'list-domains-test-1',
      'list-domains-test-2',
      'list-domains-test-3',
      'list-domains-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should return bad request for errors', async () => {
    testDomainStore.listDomains = jest.fn().mockReturnValue({ error: 'bad domain' });
    const response = await listDomainsHandler();
    expect(testDomainStore.listDomains).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({ name: 'Error', message: 'bad domain', errorId: expect.stringMatching(/\w{10}/) });
  });
});
