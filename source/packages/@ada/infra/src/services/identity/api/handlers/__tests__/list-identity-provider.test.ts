/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { ExternalIdentityProvider, GoogleProvider, IdentityProviderType } from '@ada/microservice-common';
import {
  IdentityProviderStore,
  ListExternalIdentityProvidersResponse,
} from '../../../../api/components/ddb/identity-provider';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-identity-provider';

const testIdentityStore = new (IdentityProviderStore as any)(getLocalDynamoDocumentClient());
IdentityProviderStore.getInstance = jest.fn(() => testIdentityStore);

describe('list-identity-provider', () => {
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
  const listIdentityProviderHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const generateIdentityProvider = (identtiyProviderId: string) =>
    testIdentityStore.putIdentityProvider(identtiyProviderId, 'test-user', {
      identityProviderId: 'identity-id',
      name: 'provider-name',
      description: 'identity provider description',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
      } as GoogleProvider,
      type: IdentityProviderType.Google,
    });

  it('should list all available identity providers without limit', async () => {
    let response = await listIdentityProviderHandler();
    let body = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;

    expect(response.statusCode).toBe(200);
    expect(body.providers).toBeArrayOfSize(0);
    expect(body).not.toHaveProperty('nextToken');

    await Promise.all([
      generateIdentityProvider('identity-provider-id-1'),
      generateIdentityProvider('identity-provider-id-2'),
      generateIdentityProvider('identity-provider-id-3'),
      generateIdentityProvider('identity-provider-id-4'),
    ]);

    response = await listIdentityProviderHandler();
    body = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(response.statusCode).toBe(200);
    expect(body.providers).toBeArrayOfSize(4);
    expect(body.providers.map((o: ExternalIdentityProvider) => o.identityProviderId)).toIncludeSameMembers([
      'identity-provider-id-1',
      'identity-provider-id-2',
      'identity-provider-id-3',
      'identity-provider-id-4',
    ]);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should list identity provider when limit parameter is provided', async () => {
    await Promise.all([
      generateIdentityProvider('identity-provider-id-1'),
      generateIdentityProvider('identity-provider-id-2'),
      generateIdentityProvider('identity-provider-id-3'),
      generateIdentityProvider('identity-provider-id-4'),
    ]);

    let response = await listIdentityProviderHandler({ limit: '3' });
    let body = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;

    expect(response.statusCode).toBe(200);
    expect(body.providers).toBeArrayOfSize(3);
    expect(body).not.toHaveProperty('nextToken');

    response = await listIdentityProviderHandler({ limit: '5' });
    body = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;

    expect(response.statusCode).toBe(200);
    expect(body.providers).toBeArrayOfSize(4);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should paginate identity provider based on parameters', async () => {
    await Promise.all([
      generateIdentityProvider('identity-provider-id-1'),
      generateIdentityProvider('identity-provider-id-2'),
      generateIdentityProvider('identity-provider-id-3'),
      generateIdentityProvider('identity-provider-id-4'),
    ]);

    let response = await listIdentityProviderHandler({ pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(firstPage.providers).toBeArrayOfSize(3);

    response = await listIdentityProviderHandler({ pageSize: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(secondPage.providers).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect(
      [...firstPage.providers, ...secondPage.providers].map((o: ExternalIdentityProvider) => o.identityProviderId),
    ).toIncludeSameMembers([
      'identity-provider-id-1',
      'identity-provider-id-2',
      'identity-provider-id-3',
      'identity-provider-id-4',
    ]);
  });

  it('should paginate identity provider based on parameters when limit is applied', async () => {
    await Promise.all([
      generateIdentityProvider('identity-provider-id-1'),
      generateIdentityProvider('identity-provider-id-2'),
      generateIdentityProvider('identity-provider-id-3'),
      generateIdentityProvider('identity-provider-id-4'),
    ]);

    let response = await listIdentityProviderHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(firstPage.providers).toBeArrayOfSize(2);

    response = await listIdentityProviderHandler({ pageSize: '2', limit: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(secondPage.providers).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await Promise.all([
      generateIdentityProvider('identity-provider-id-1'),
      generateIdentityProvider('identity-provider-id-2'),
      generateIdentityProvider('identity-provider-id-3'),
      generateIdentityProvider('identity-provider-id-4'),
    ]);

    let response = await listIdentityProviderHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(firstPage.providers).toBeArrayOfSize(2);

    // Limit in the second request should be ignored
    response = await listIdentityProviderHandler({ pageSize: '2', limit: '9999', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListExternalIdentityProvidersResponse;
    expect(secondPage.providers).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should return 400 when given an invalid nextToken', async () => {
    const response = await listIdentityProviderHandler({ nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    const response = await listIdentityProviderHandler({ limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    const response = await listIdentityProviderHandler({ pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });
});
