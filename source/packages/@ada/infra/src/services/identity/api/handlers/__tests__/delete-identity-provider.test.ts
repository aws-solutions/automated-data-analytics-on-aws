/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ExternalIdentityProvider, GoogleProvider, IdentityProviderType } from '@ada/microservice-common';
import { IdentityProviderStore } from '../../../../api/components/ddb/identity-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../delete-identity-provider';
import { handler as putHandler } from '../put-identity-provider';

// for testing purpose
class ResourceNotFoundException extends Error {
  readonly code: string;
  constructor(message: string) {
    super(message);
    this.code = 'ResourceNotFoundException';
  }
}

const testIdentityProviderStore = new (IdentityProviderStore as any)(getLocalDynamoDocumentClient());
IdentityProviderStore.getInstance = jest.fn(() => testIdentityProviderStore);

const createIdentityProviderMock = jest.fn();
const updateIdentityProviderMock = jest.fn();
const describeIdentityProviderMock = jest.fn();
const deleteIdentityProviderMock = jest.fn();
const describeUserPoolClientMock = jest.fn();
const updateUserPoolClientMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    createIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(createIdentityProviderMock(...args))),
    }),
    updateIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(updateIdentityProviderMock(...args))),
    }),
    describeIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(describeIdentityProviderMock(...args))),
    }),
    deleteIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(deleteIdentityProviderMock(...args))),
    }),
    describeUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(describeUserPoolClientMock(...args))),
    }),
    updateUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(updateUserPoolClientMock(...args))),
    }),
  })),
}));

describe('delete-identity-provider', () => {
  const now = '2021-01-01T00:00:00.000Z';
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
    jest.clearAllMocks();
    createIdentityProviderMock.mockReset();
    updateIdentityProviderMock.mockReset();
    describeIdentityProviderMock.mockReset();
    deleteIdentityProviderMock.mockReset();
    describeUserPoolClientMock.mockReset();
    updateUserPoolClientMock.mockReset();
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the put identity provider handler
  const putIdentityProviderHandler = (
    identityProviderId: string,
    provider: Omit<ExternalIdentityProvider, 'identityProviderId'>,
  ): Promise<APIGatewayProxyResult> =>
    putHandler(
      apiGatewayEvent({
        pathParameters: { identityProviderId },
        body: JSON.stringify(provider),
      }),
      null,
    );

  // Helper method for calling the handler
  const deleteIdentityProviderHandler = (identityProviderId: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { identityProviderId },
      }),
      null,
    );

  it('should delete an identity provider', async () => {
    const identityProviderId = 'Google';
    const existingProvider = {
      IdentityProvider: {
        ProviderName: identityProviderId,
      },
    };
    const newPoolClientConf = {
      UserPoolClient: {
        SupportedIdentityProviders: [identityProviderId],
      },
    };

    describeIdentityProviderMock.mockImplementationOnce(() => {
      throw new ResourceNotFoundException('err');
    });
    describeIdentityProviderMock.mockReturnValueOnce(existingProvider);
    createIdentityProviderMock.mockReturnValueOnce(existingProvider);
    updateIdentityProviderMock.mockReturnValueOnce(existingProvider);
    describeUserPoolClientMock
      .mockReturnValueOnce({
        UserPoolClient: {
          SupportedIdentityProviders: [],
        },
      })
      .mockReturnValueOnce({
        UserPoolClient: {
          SupportedIdentityProviders: [identityProviderId],
        },
      });
    describeUserPoolClientMock.mockReturnValueOnce(newPoolClientConf);
    updateUserPoolClientMock.mockReturnValueOnce(newPoolClientConf);

    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
      } as GoogleProvider,
      type: IdentityProviderType.Google,
    };
    const expectedIdentityProvider = {
      ...identityProvider,
      identityProviderId,
      ...createUpdateDetails,
      enabled: true,
    };

    const response = await putIdentityProviderHandler(identityProviderId, identityProvider);
    const body = JSON.parse(response.body) as ExternalIdentityProvider;

    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual(expectedIdentityProvider);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toStrictEqual(
      expectedIdentityProvider,
    );
    expect(describeIdentityProviderMock).toBeCalledTimes(1);
    expect(describeIdentityProviderMock).toBeCalledWith({
      ProviderName: identityProviderId,
      UserPoolId: expect.anything(),
    });
    expect(createIdentityProviderMock).toBeCalledTimes(1);
    expect(createIdentityProviderMock).toBeCalledWith({
      UserPoolId: expect.anything(),
      ProviderDetails: {
        authorize_scopes: 'a b c',
        client_id: 'client-id',
        client_secret: 'client-secret',
      },
      ProviderType: identityProvider.type,
      ProviderName: identityProviderId,
      AttributeMapping: undefined,
    });
    expect(describeUserPoolClientMock).toBeCalledTimes(1);
    expect(describeUserPoolClientMock).toBeCalledWith({
      ClientId: expect.anything(),
      UserPoolId: expect.anything(),
    });
    expect(updateUserPoolClientMock).toBeCalledTimes(1);
    expect(updateUserPoolClientMock).toBeCalledWith({
      ClientId: expect.anything(),
      UserPoolId: expect.anything(),
      SupportedIdentityProviders: [identityProviderId],
    });

    const deleteResponse = await deleteIdentityProviderHandler(identityProviderId);
    const deletedProvider = JSON.parse(deleteResponse.body) as ExternalIdentityProvider;

    expect(deleteResponse.statusCode).toBe(200);
    expect(deletedProvider).toStrictEqual(expectedIdentityProvider);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toBeUndefined();

    expect(deleteIdentityProviderMock).toBeCalledTimes(1);
    expect(deleteIdentityProviderMock).toHaveBeenCalledWith({
      ProviderName: identityProviderId,
      UserPoolId: expect.anything(),
    });
    expect(describeUserPoolClientMock).toBeCalledTimes(2);
    expect(updateUserPoolClientMock).toBeCalledTimes(2);
    expect(updateUserPoolClientMock).toBeCalledWith({
      ClientId: expect.anything(),
      UserPoolId: expect.anything(),
      SupportedIdentityProviders: [],
    });
  });

  it('should return 404 when deleting an identity provider that does not exist', async () => {
    const response = await deleteIdentityProviderHandler('does-not-exist');
    expect(response.statusCode).toBe(404);
  });
});
