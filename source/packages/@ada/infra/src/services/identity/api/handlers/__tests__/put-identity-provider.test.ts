/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AttributeRequestMethod,
  ExternalIdentityProvider,
  GoogleProvider,
  IdentityProviderType,
  OIDCProvider,
  SAMLProvider,
} from '@ada/microservice-common';
import { IdentityProviderStore } from '../../../../api/components/ddb/identity-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../put-identity-provider';
import { isEmpty } from 'lodash';

// for testing purpose
class ResourceNotFoundException extends Error {
  readonly code: string;
  constructor(message: string) {
    super(message);
    this.code = 'ResourceNotFoundException';
  }
}

class IllegalParameterException extends Error {
  readonly code: string;
  constructor(message: string) {
    super(message);
    this.code = 'IllegalParameterException';
  }
}

const testIdentityProviderStore = new (IdentityProviderStore as any)(getLocalDynamoDocumentClient());
IdentityProviderStore.getInstance = jest.fn(() => testIdentityProviderStore);

const createIdentityProviderMock = jest.fn();
const updateIdentityProviderMock = jest.fn();
const describeIdentityProviderMock = jest.fn();
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
    describeUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(describeUserPoolClientMock(...args))),
    }),
    updateUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(updateUserPoolClientMock(...args))),
    }),
  })),
}));

describe('put-identity-provider', () => {
  const before = '2020-01-01T00:00:00.000Z';
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
    describeUserPoolClientMock.mockReset();
    updateUserPoolClientMock.mockReset();
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putIdentityProviderHandler = (
    identityProviderId: string,
    provider: Omit<ExternalIdentityProvider, 'identityProviderId'>,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { identityProviderId },
        body: JSON.stringify(provider),
      }),
      null,
    );

  it('should NOT create an identity provider if item with same id exists', async () => {
    const identityProviderId = 'external-provider-id';
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
    describeUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: [],
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
      ProviderName: identityProvider.type,
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
      ProviderName: identityProvider.type,
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
      SupportedIdentityProviders: [identityProvider.type],
    });

    const updateIdentityProvider: ExternalIdentityProvider = {
      ...identityProvider,
      description: 'new description',
      identityProviderId: 'new-id',
      details: {
        ...identityProvider.details,
        clientId: 'new-client-id',
      } as GoogleProvider,
      enabled: true,
    };

    const updateResponse = await putIdentityProviderHandler(identityProviderId, updateIdentityProvider);
    const updatedBody = JSON.parse(updateResponse.body);

    expect(updateResponse.statusCode).toBe(400);
    expect(updatedBody?.message).toContain('Item with same id already exists');
  });

  it('should NOT update an identity provider if updatedTimestamp does not match', async () => {
    const identityProviderId = 'external-provider-id';
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
    describeUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: [],
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
        attributeRequestMethod: AttributeRequestMethod.GET,
        issuer: 'https://an-issuer.example.com',
      } as OIDCProvider,
      type: IdentityProviderType.OIDC,
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
      ProviderDetails: expect.objectContaining({
        authorize_scopes: 'a b c',
        client_id: 'client-id',
        client_secret: 'client-secret',
        attributes_request_method: 'GET',
        oidc_issuer: 'https://an-issuer.example.com',
      }),
      ProviderType: identityProvider.type,
      ProviderName: identityProviderId,
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

    const updateIdentityProvider: ExternalIdentityProvider = {
      ...identityProvider,
      description: 'new description',
      identityProviderId: identityProviderId,
      details: {
        ...identityProvider.details,
        clientId: 'new-client-id',
      } as OIDCProvider,
      enabled: true,
      updatedTimestamp: before,
    };

    const updateResponse = await putIdentityProviderHandler(identityProviderId, updateIdentityProvider);
    const updatedBody = JSON.parse(updateResponse.body);

    expect(updateResponse.statusCode).toBe(400);
    expect(updatedBody?.message).toContain('cannot be updated');
  });

  it('should NOT be able to create more than one Google identity provider', async () => {
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

    describeIdentityProviderMock.mockReturnValueOnce(existingProvider);
    createIdentityProviderMock.mockReturnValueOnce(existingProvider);
    updateIdentityProviderMock.mockReturnValueOnce(existingProvider);
    describeUserPoolClientMock.mockReturnValueOnce({
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

    const newId = 'new-google-identity-provider-id';
    const response = await putIdentityProviderHandler(newId, identityProvider);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body?.message).toContain('Duplicate identity provider');
    expect(describeIdentityProviderMock).toBeCalledTimes(1);
    expect(describeIdentityProviderMock).toBeCalledWith({
      ProviderName: identityProvider.type,
      UserPoolId: expect.anything(),
    });
    expect(createIdentityProviderMock).toBeCalledTimes(0);
    expect(describeUserPoolClientMock).toBeCalledTimes(0);
    expect(updateUserPoolClientMock).toBeCalledTimes(0);
    expect(await testIdentityProviderStore.getIdentityProvider(newId)).toBeFalsy();
  });

  it('should create and update a Google identity provider', async () => {
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
    describeUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: [],
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
      ProviderName: identityProvider.type,
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
      ProviderName: identityProvider.type,
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
      SupportedIdentityProviders: [identityProvider.type],
    });

    const updateIdentityProvider: ExternalIdentityProvider = {
      ...identityProvider,
      description: 'new description',
      identityProviderId: identityProviderId,
      details: {
        ...identityProvider.details,
        clientId: 'new-client-id',
      } as GoogleProvider,
      enabled: true,
      updatedTimestamp: expectedIdentityProvider.updatedTimestamp,
    };

    const expectedUpdatedIdentityProvider = {
      ...updateIdentityProvider,
      ...createUpdateDetails,
    };

    const updateResponse = await putIdentityProviderHandler(identityProviderId, updateIdentityProvider);

    expect(updateResponse.statusCode).toBe(200);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toStrictEqual(
      expectedUpdatedIdentityProvider,
    );
    expect(describeIdentityProviderMock).toBeCalledTimes(2);
    expect(describeIdentityProviderMock).nthCalledWith(2, {
      ProviderName: identityProvider.type,
      UserPoolId: expect.anything(),
    });
    expect(createIdentityProviderMock).toBeCalledTimes(1);
    expect(updateIdentityProviderMock).toBeCalledTimes(1);
    expect(describeUserPoolClientMock).toBeCalledTimes(2);
    expect(updateUserPoolClientMock).toBeCalledTimes(1);
  });

  it('should create and update an OIDC identity provider', async () => {
    const identityProviderId = 'external-provider-id';

    describeIdentityProviderMock.mockImplementationOnce(() => {
      throw new ResourceNotFoundException('err');
    });
    createIdentityProviderMock.mockReturnValue({
      IdentityProvider: {
        ProviderName: identityProviderId,
      },
    });
    describeUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        SupportedIdentityProviders: ['existing'],
      },
    });
    updateUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        SupportedIdentityProviders: ['existing', identityProviderId],
      },
    });

    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
        attributeRequestMethod: AttributeRequestMethod.GET,
        issuer: 'https://an-issuer.example.com',
      } as OIDCProvider,
      type: IdentityProviderType.OIDC,
      enabled: true,
    };
    const expectedIdentityProvider = {
      ...identityProvider,
      identityProviderId,
      ...createUpdateDetails,
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
    const expectedProvider = {
      UserPoolId: expect.anything(),
      ProviderDetails: expect.objectContaining({
        authorize_scopes: 'a b c',
        client_id: 'client-id',
        client_secret: 'client-secret',
        attributes_request_method: 'GET',
        oidc_issuer: 'https://an-issuer.example.com',
      }),
      ProviderType: identityProvider.type,
      ProviderName: identityProviderId,
    };
    expect(createIdentityProviderMock).toBeCalledWith(expectedProvider);
    expect(describeUserPoolClientMock).toBeCalledTimes(1);
    expect(describeUserPoolClientMock).toBeCalledWith({
      ClientId: expect.anything(),
      UserPoolId: expect.anything(),
    });
    expect(updateUserPoolClientMock).toBeCalledTimes(1);
    expect(updateUserPoolClientMock).toBeCalledWith({
      ClientId: expect.anything(),
      UserPoolId: expect.anything(),
      SupportedIdentityProviders: ['existing', identityProviderId],
    });

    const updateIdentityProvider: ExternalIdentityProvider = {
      ...identityProvider,
      description: 'new description',
      identityProviderId: identityProviderId,
      details: {
        ...identityProvider.details,
        clientId: 'new-client-id',
      } as OIDCProvider,
      enabled: true,
      updatedTimestamp: expectedIdentityProvider.updatedTimestamp,
    };

    const expectedUpdatedIdentityProvider = {
      ...updateIdentityProvider,
      ...createUpdateDetails,
    };

    const updateResponse = await putIdentityProviderHandler(identityProviderId, updateIdentityProvider);
    const updatedBody = JSON.parse(updateResponse.body) as ExternalIdentityProvider;

    expect(updateResponse.statusCode).toBe(200);
    expect(updatedBody).toStrictEqual(expectedUpdatedIdentityProvider);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toStrictEqual(
      expectedUpdatedIdentityProvider,
    );
    expect(describeIdentityProviderMock).toBeCalledTimes(2);
    expect(describeIdentityProviderMock).nthCalledWith(2, {
      ProviderName: identityProviderId,
      UserPoolId: expect.anything(),
    });
    expect(createIdentityProviderMock).toBeCalledTimes(1);
    expect(updateIdentityProviderMock).toBeCalledTimes(1);
    expect(updateIdentityProviderMock).toHaveBeenCalledWith({
      ProviderDetails: expect.objectContaining({
        authorize_scopes: 'a b c',
        client_id: 'new-client-id',
        client_secret: 'client-secret',
        attributes_request_method: 'GET',
        oidc_issuer: 'https://an-issuer.example.com',
      }),
      ProviderName: identityProviderId,
      UserPoolId: expect.anything(),
    });
    expect(describeUserPoolClientMock).toBeCalledTimes(2);
    expect(updateUserPoolClientMock).toBeCalledTimes(2);
  });

  it.each([
    [undefined, undefined],
    [true, 'any-content'],
    [false, ''],
  ])(
    'should create an SAML identity provider with signOut field as %s and XML content as (%s)',
    async (signOut, fileContent) => {
      const identityProviderId = 'external-provider-id';

      describeIdentityProviderMock.mockImplementationOnce(() => {
        throw new ResourceNotFoundException('err');
      });
      createIdentityProviderMock.mockReturnValueOnce({
        IdentityProvider: {
          ProviderName: identityProviderId,
        },
      });
      describeUserPoolClientMock.mockReturnValueOnce({
        UserPoolClient: {
          SupportedIdentityProviders: ['existing'],
        },
      });
      updateUserPoolClientMock.mockReturnValueOnce({
        UserPoolClient: {
          SupportedIdentityProviders: ['existing', identityProviderId],
        },
      });

      const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
        description: 'a brief description',
        name: 'provider name',
        details: {
          metadataFile: fileContent ? Buffer.from(fileContent, 'utf-8').toString('base64') : undefined,
          metadataURL: 'https://an-url.example.com',
          signOut,
        } as SAMLProvider,
        type: IdentityProviderType.SAML,
      };
      if (fileContent == null || isEmpty(fileContent)) {
        fileContent = undefined;
      }
      const expectedIdentityProvider = {
        ...identityProvider,
        details: {
          ...identityProvider.details,
          metadataFile: fileContent,
        },
        identityProviderId,
        ...createUpdateDetails,
        enabled: true,
      };

      const response = await putIdentityProviderHandler(identityProviderId, identityProvider);
      const body = JSON.parse(response.body) as ExternalIdentityProvider;

      expect(response.statusCode).toBe(200);
      expect(body).toEqual(expectedIdentityProvider);
      expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toEqual(expectedIdentityProvider);
      expect(describeIdentityProviderMock).toBeCalledTimes(1);
      expect(describeIdentityProviderMock).toBeCalledWith({
        ProviderName: identityProviderId,
        UserPoolId: expect.anything(),
      });
      expect(createIdentityProviderMock).toBeCalledTimes(1);
      expect(createIdentityProviderMock).toBeCalledWith({
        UserPoolId: expect.anything(),
        ProviderDetails: expect.objectContaining({
          MetadataFile: fileContent,
          MetadataURL: 'https://an-url.example.com',
          IDPSignout: signOut !== undefined ? signOut.toString() : undefined,
        }),
        ProviderType: identityProvider.type,
        ProviderName: identityProviderId,
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
        SupportedIdentityProviders: ['existing', identityProviderId],
      });
    },
  );

  it('should disable an identity provider', async () => {
    const identityProviderId = 'external-provider-id';
    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
        attributeRequestMethod: AttributeRequestMethod.GET,
        issuer: 'https://an-issuer.example.com',
      } as OIDCProvider,
      type: IdentityProviderType.OIDC,
      enabled: true,
    };

    await testIdentityProviderStore.putIdentityProvider('identity-provider-id', 'test-user', identityProvider);

    const existingProvider = {
      IdentityProvider: {
        ProviderName: identityProviderId,
      },
    };
    describeIdentityProviderMock.mockReturnValue(existingProvider);
    updateIdentityProviderMock.mockReturnValueOnce(existingProvider);
    describeUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: ['existing', identityProviderId],
      },
    });
    updateUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: ['existing'],
      },
    });

    const response = await putIdentityProviderHandler(identityProviderId, { ...identityProvider, enabled: false });
    const body = JSON.parse(response.body) as ExternalIdentityProvider;

    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual(
      expect.objectContaining({
        enabled: false,
      }),
    );
    expect(testIdentityProviderStore.getIdentityProvider(identityProviderId)).resolves.toStrictEqual(
      expect.objectContaining({
        enabled: false,
      }),
    );
    expect(describeIdentityProviderMock).toHaveBeenCalled();
    expect(updateIdentityProviderMock).toHaveBeenCalled();
    expect(describeUserPoolClientMock).toHaveBeenCalled();
    expect(updateUserPoolClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        SupportedIdentityProviders: ['existing'],
      }),
    );
  });

  it('failure to disable an identity provider returns bad request', async () => {
    const identityProviderId = 'external-provider-id';
    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
        attributeRequestMethod: AttributeRequestMethod.GET,
        issuer: 'https://an-issuer.example.com',
      } as OIDCProvider,
      type: IdentityProviderType.OIDC,
      enabled: true,
    };

    await testIdentityProviderStore.putIdentityProvider('identity-provider-id', 'test-user', identityProvider);

    const existingProvider = {
      IdentityProvider: {
        ProviderName: identityProviderId,
      },
    };
    describeIdentityProviderMock.mockReturnValue(existingProvider);
    updateIdentityProviderMock.mockReturnValueOnce(existingProvider);
    describeUserPoolClientMock.mockReturnValueOnce({
      UserPoolClient: {
        SupportedIdentityProviders: ['existing', identityProviderId],
      },
    });

    updateUserPoolClientMock.mockImplementationOnce(() => {
      throw new IllegalParameterException('illegal params');
    });

    const response = await putIdentityProviderHandler(identityProviderId, { ...identityProvider, enabled: false });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body?.message).toContain('Error enabling/disabling provider in user pool client');
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toBeFalsy();
    expect(describeIdentityProviderMock).toHaveBeenCalled();
    expect(updateIdentityProviderMock).toHaveBeenCalled();
    expect(describeUserPoolClientMock).toHaveBeenCalled();
    expect(updateUserPoolClientMock).toHaveBeenCalled();
  });
});
