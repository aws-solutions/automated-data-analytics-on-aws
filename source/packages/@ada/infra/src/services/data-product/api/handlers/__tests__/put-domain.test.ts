/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds, ReservedDomains } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { Domain } from '@ada/api';
import { DomainStore } from '../../../components/ddb/domain';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-domain';

// Mock the domain store to point to our local dynamodb
const testDomainStore = new (DomainStore as any)(getLocalDynamoDocumentClient());
DomainStore.getInstance = jest.fn(() => testDomainStore);

describe('put-domain', () => {
  const before = '2020-01-01T00:00:00.000Z';
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putDomainHandler = (
    domainId: string,
    domain: Omit<Domain, 'domainId'>,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { domainId },
        body: domain,
      }) as any,
      null,
    );

  it('should create and update domain', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const updatedDomain = {
      ...domain,
      description: 'new description',
      updatedTimestamp: now,
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const updateResponse = await putDomainHandler('create-update-test-domain-id', updatedDomain);
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedDomain = {
      ...updatedDomain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedDomain);

    // Check the domain is written to dynamodb
    expect(await testDomainStore.getDomain('create-update-test-domain-id')).toEqual(expectedUpdatedDomain);
  });

  it('should NOT update a domain if the user that updates it is different that who created', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const updatedDomain = {
      ...domain,
      description: 'new description',
      updatedTimestamp: now,
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const updateResponse = await putDomainHandler('create-update-test-domain-id', updatedDomain, {
      groups: [DefaultGroupIds.DEFAULT],
      userId: 'different-user',
      username: 'any',
    });
    expect(updateResponse.statusCode).toBe(403);
    expect(JSON.parse(updateResponse.body).message).toContain(
      "You don't have permissions to update the domain with id create-update-test-domain-id",
    );
  });

  it('should update a domain if the user that updates it is different that who created but belongs to the admin group', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const updatedDomain = {
      ...domain,
      description: 'new description',
      updatedTimestamp: now,
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const updateResponse = await putDomainHandler('create-update-test-domain-id', updatedDomain, {
      groups: [DefaultGroupIds.ADMIN, DefaultGroupIds.DEFAULT],
      userId: 'different-user',
      username: 'any',
    });
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedDomain = {
      ...updatedDomain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'different-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedDomain);

    // Check the domain is written to dynamodb
    expect(await testDomainStore.getDomain('create-update-test-domain-id')).toEqual(expectedUpdatedDomain);
  });

  it('should NOT create a domain if item with same id exist', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const duplicatedDomain = {
      ...domain,
      description: 'new description',
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const updateResponse = await putDomainHandler('create-update-test-domain-id', duplicatedDomain);

    expect(updateResponse.statusCode).toBe(400);

    expect(JSON.parse(updateResponse.body)?.message).toContain('Item with same id already exists');

    // Check the new domain is not written to dynamodb
    expect(await testDomainStore.getDomain('create-update-test-domain-id')).toEqual(expectedDomain);
  });

  it('should NOT create a domain if item with same id exists', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const duplicateDomain = {
      ...domain,
      description: 'new description',
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const duplicateResponse = await putDomainHandler('create-update-test-domain-id', duplicateDomain);
    expect(duplicateResponse.statusCode).toBe(400);

    expect(JSON.parse(duplicateResponse.body)?.message).toContain('Item with same id already exists');

    // Check the domain is written to dynamodb
    expect(await testDomainStore.getDomain('create-update-test-domain-id')).toEqual(expectedDomain);
  });

  it('should NOT update a domain if updated timestamp does not match', async () => {
    const domain = {
      name: 'test domain',
      description: 'test description',
    };

    // Create our new domain
    const response = await putDomainHandler('create-update-test-domain-id', domain);
    expect(response.statusCode).toBe(200);

    const expectedDomain = {
      ...domain,
      domainId: 'create-update-test-domain-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedDomain);

    const updatedDomain = {
      ...domain,
      description: 'new description',
      updatedTimestamp: before,
    };

    // Update the domain, adding and removing some aliases
    // Create our new domain
    const updateResponse = await putDomainHandler('create-update-test-domain-id', updatedDomain);
    expect(updateResponse.statusCode).toBe(400);

    expect(JSON.parse(updateResponse.body)?.message).toContain('cannot be updated');

    // Check the domain is written to dynamodb
    expect(await testDomainStore.getDomain('create-update-test-domain-id')).toEqual(expectedDomain);
  });

  it.each(Object.values(ReservedDomains))('should not create a domain with a reserved domainId', async (domainId) => {
    const response = await putDomainHandler(domainId, {
      name: 'Bad Domain',
    });
    expect(response.statusCode).toBe(400);
  });
});
