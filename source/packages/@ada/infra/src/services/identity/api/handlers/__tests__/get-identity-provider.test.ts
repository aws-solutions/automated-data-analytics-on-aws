/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from '@ada/api';
import { ExternalIdentityProvider, GoogleProvider, IdentityProviderType } from '@ada/microservice-common';
import {
  ExternalIdentityProviderWithCreateUpdateDetails,
  IdentityProviderStore,
} from '../../../../api/components/ddb/identity-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-identity-provider';

const testIdentityProviderStore = new (IdentityProviderStore as any)(getLocalDynamoDocumentClient());
IdentityProviderStore.getInstance = jest.fn(() => testIdentityProviderStore);

describe('get-identity-provider', () => {
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
  const getIdentityProviderHandler = (identityProviderId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { identityProviderId },
      }),
      null,
    );

  it('should return an identity provider if exists', async () => {
    const identityProvider: ExternalIdentityProvider = {
      identityProviderId: 'identity-id',
      name: 'provider-name',
      description: 'identity provider description',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
      } as GoogleProvider,
      type: IdentityProviderType.Google,
    };

    await testIdentityProviderStore.putIdentityProvider('identity-provider-id', 'test-user', identityProvider);

    const response = await getIdentityProviderHandler('identity-provider-id');
    const body = JSON.parse(response.body) as ExternalIdentityProviderWithCreateUpdateDetails;

    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual({
      ...identityProvider,
      identityProviderId: 'identity-provider-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    });
  });

  it('should return 404 if the identity provider does not exist', async () => {
    const response = await getIdentityProviderHandler('identity-provider-id-does-not-exists');
    const body = JSON.parse(response.body) as ApiError;

    expect(response.statusCode).toBe(404);
    expect(body.message).toEqual(
      'Not Found: no identity provider was found with identityProviderId identity-provider-id-does-not-exists',
    );
  });
});
