/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { Domain } from '@ada/api';
import { DomainStore } from '../../../components/ddb/domain';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { handler } from '../delete-domain';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

// Mock the domain store to point to our local dynamodb
const testDomainStore = new (DomainStore as any)(getLocalDynamoDocumentClient());
DomainStore.getInstance = jest.fn(() => testDomainStore);

const domainId = 'test-domain';
const domain: Domain = {
  domainId,
  name: 'My Test Domain',
};
const domainEntity = entityIdentifier('DataProductDomain', { domainId });

describe('delete-domain', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    relationshipClient = localDynamoRelationshipClient();
    localDynamoLockClient();
  });

  // Helper method for calling the handler
  const deleteDomainHandler = (
    domainId: string,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { domainId },
      }) as any,
      null,
    );

  it('should return 404 when the domain does not exist', async () => {
    expect((await deleteDomainHandler('does-not-exist')).statusCode).toBe(404);
  });

  it('should not delete a domain that contains data products', async () => {
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    await relationshipClient.addRelationships(DEFAULT_CALLER, domainEntity, [
      entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId: 'my-data-product' }),
    ]);

    const response = await deleteDomainHandler(domainId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('my-data-product');
  });

  it('should not delete a domain that contains saved queries', async () => {
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    await relationshipClient.addRelationships(DEFAULT_CALLER, domainEntity, [
      entityIdentifier('QuerySavedQuery', { namespace: domainId, queryId: 'my-query' }),
    ]);

    const response = await deleteDomainHandler(domainId);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('my-query');
  });

  it('should delete a domain', async () => {
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    const response = await deleteDomainHandler(domainId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(domain));
  });

  it('should return 403 trying if the user is not the same that created the', async () => {
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    const response = await deleteDomainHandler(domainId, {
      groups: [DefaultGroupIds.DEFAULT],
      userId: 'different-user',
      username: 'any',
    });
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).message).toContain(
      `You don't have permissions to delete the domain with id ${domainId}`,
    );
  });

  it('should delete a domain that if the user is not the same but belongs to the admin group', async () => {
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    const response = await deleteDomainHandler(domainId, {
      groups: [DefaultGroupIds.ADMIN, DefaultGroupIds.DEFAULT],
      userId: 'different-user',
      username: 'any',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(domain));
  });

  it('should delete all scripts within the domain', async () => {
    API.deleteDataProductScriptsNamespaceScript.mockResolvedValue({});
    await testDomainStore.putDomain(domainId, 'test-user', domain);
    await relationshipClient.addRelationships(DEFAULT_CALLER, domainEntity, [
      entityIdentifier('DataProductScript', { namespace: domainId, scriptId: 'my-script' }),
    ]);

    const response = await deleteDomainHandler(domainId);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(domain));

    expect(API.deleteDataProductScriptsNamespaceScript).toHaveBeenCalledWith({
      namespace: domainId,
      scriptId: 'my-script',
    });
    expect(await relationshipClient.getRelatedEntities(domainEntity)).toHaveLength(0);
  });
});
