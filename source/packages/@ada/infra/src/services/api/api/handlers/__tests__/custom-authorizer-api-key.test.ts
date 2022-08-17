/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs';
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { AuthorizationType, CustomCognitoAttributes, addDays } from '@ada/common';
import { CustomAuthorizerEventType, MAX_USER_MISSING_LOGIN, handler } from '../custom-authorizer';
import { GroupStore } from '../../../components/ddb/groups';
import { Token } from '@ada/microservice-common';
import { TokenStore } from '../../../components/ddb/token-provider';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import jwkToPem from 'jwk-to-pem';
import jwt from 'jsonwebtoken';
import { TEST_REGION } from '@ada/cdk-core';

const ISS = `https://cognito-idp.${TEST_REGION}.amazonaws.com/user-pool-id`

const adminGetUserMock = jest.fn();
const getAccessTokenMock = jest.fn();

jest.mock('node-fetch');
jest.mock('@ada/jwt-signer');
jest.mock('jsonwebtoken');
jest.mock('jwk-to-pem');
jest.mock('fs');
jest.mock('../../../../../common/services/utils/cognito', () => ({
  getAccessToken: jest.fn().mockImplementation(() => getAccessTokenMock()),
}));
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    adminGetUser: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(adminGetUserMock(...args))),
    }),
  })),
}));

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

// Mock the api access policy to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

const testTokenStore: TokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

describe('custom-authorizer-api-key', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const mockContext = {
    fail: jest.fn(),
  };

  const mockValidAccessToken = (accessTokenResult: any) => {
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as unknown as jest.Mock).mockReturnValueOnce(
      JSON.stringify({ keys: [{ kid: 'test-kid', any: 'prop' }] }),
    );
    (jwkToPem as unknown as jest.Mock).mockReturnValueOnce('pem-output');
    jwt.decode = jest.fn().mockReturnValueOnce({
      header: {
        kid: 'test-kid',
      },
    });
    jwt.verify = jest.fn().mockReturnValueOnce(accessTokenResult);
  };

  const validateJwkExecution = () => {
    expect(jwkToPem).toHaveBeenNthCalledWith(1, { any: 'prop', kid: 'test-kid' });
    expect(jwt.decode).toHaveBeenNthCalledWith(1, 'access-token', { complete: true });
    expect(jwt.verify).toHaveBeenNthCalledWith(1, 'access-token', 'pem-output');
  };

  const generateGroup = (groupId: string, apiAccessPolicyIds: string[]) =>
    testGroupStore.putGroup(groupId, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    });

  const generateGeneratedApiAccessPolicy = (apiAccessPolicyId: string, resources: string[]) =>
    testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', {
      name: 'test name',
      description: 'test description',
      resources,
    });

  it('should send unauthorized if the provided token cannot be decoded correctly', async () => {
    jwt.decode = jest.fn().mockReturnValueOnce(null);
    getAccessTokenMock.mockReturnValue('access-token');

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
  });

  it('should send unauthorized if the token issuer is not valid', async () => {
    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: 'invalid-issuer',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the token is expired', async () => {
    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Math.floor((Date.now() - 1000) / 1000),
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the token with clientId provided does not exists', async () => {
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), 1).toISOString(),
      username: 'usr',
      clientId: 'abcd',
    } as Token);

    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'different-client-id',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the token with clientId provided is already expired', async () => {
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), -10).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'different-client-id',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the token is disabled', async () => {
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: false,
      expiration: addDays(Date.now(), 1).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'abcd',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the user associated to the token does not exist', async () => {
    adminGetUserMock.mockReturnValue(null);
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), 1).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'abcd',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if the user has not logged in for more than 90 days', async () => {
    adminGetUserMock.mockReturnValue({
      UserLastModifiedDate: addDays(Date.now(), -(MAX_USER_MISSING_LOGIN + 2)),
    });
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), 1).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    getAccessTokenMock.mockReturnValue('access-token');
    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'abcd',
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it.each([
    [{ UserLastModifiedDate: new Date() }],
    [{ UserAttributes: undefined, UserLastModifiedDate: new Date() }],
    [{ UserAttributes: [], UserLastModifiedDate: new Date() }],
    [{ UserAttributes: [{ Name: 'not-the-property', Value: 'we-need' }], UserLastModifiedDate: new Date() }],
    [
      {
        UserAttributes: [{ Name: `custom:${CustomCognitoAttributes.GROUPS}`, Value: '' }],
        UserLastModifiedDate: new Date(),
      },
    ],
  ])(
    'should return the default access policy document if the user does not have the group attribute value',
    async (userValue) => {
      adminGetUserMock.mockReturnValue(userValue);

      await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
        enabled: true,
        expiration: addDays(Date.now(), 1).toISOString(),
        clientId: 'abcd',
        username: 'usr',
      } as Token);

      getAccessTokenMock.mockReturnValue('access-token');
      mockValidAccessToken({
        scope: 'ada/userid',
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 10000,
        client_id: 'abcd',
      });

      const result = await handler({
        headers: {
          authorization: `${AuthorizationType.API_KEY} a-mock-token`,
        },
      } as unknown as CustomAuthorizerEventType);

      expect(result).toStrictEqual({
        context: { 'x-groups': '', 'x-user-id': 'test-user', 'x-username': 'usr' },
        policyDocument: {
          Statement: [
            { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['default-access1', 'default-access2'] },
          ],
          Version: '2012-10-17',
        },
        principalId: 'test-user',
      });
      validateJwkExecution();
    },
  );

  it('should return an empty policy document if the user is not mapped to a configured group', async () => {
    getAccessTokenMock.mockReturnValue('access-token');
    adminGetUserMock.mockReturnValue({
      UserAttributes: [{ Name: `custom:${CustomCognitoAttributes.GROUPS}`, Value: 'reader' }],
      UserLastModifiedDate: new Date(),
    });

    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), 1).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'abcd',
    });

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.API_KEY} a-mock-token`,
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'reader', 'x-username': 'usr', 'x-user-id': 'test-user' },
      policyDocument: {
        Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: [] }],
        Version: '2012-10-17',
      },
      principalId: 'test-user',
    });
    validateJwkExecution();
  });

  it('should return the expected policy if the user is mapped correctly', async () => {
    getAccessTokenMock.mockReturnValue('access-token');
    adminGetUserMock.mockReturnValue({
      UserAttributes: [{ Name: `custom:${CustomCognitoAttributes.GROUPS}`, Value: 'admin' }],
      UserLastModifiedDate: new Date(),
    });

    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', {
      enabled: true,
      expiration: addDays(Date.now(), 1).toISOString(),
      clientId: 'abcd',
      username: 'usr',
    } as Token);

    mockValidAccessToken({
      scope: 'ada/userid',
      iss: ISS,
      token_use: 'access',
      exp: Date.now() + 10000,
      client_id: 'abcd',
    });

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.API_KEY} a-mock-token`,
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin', 'x-user-id': 'test-user', 'x-username': 'usr' },
      policyDocument: {
        Statement: [
          { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['resource-3', 'resource-1', 'resource-2'] },
        ],
        Version: '2012-10-17',
      },
      principalId: 'test-user',
    });
    validateJwkExecution();
  });
});
