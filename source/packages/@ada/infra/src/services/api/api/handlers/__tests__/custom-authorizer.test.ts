/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs';
import { AdditionalHeaders, AuthorizationType } from '@ada/common';
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { CustomAuthorizerEventType, getJwk, handler } from '../custom-authorizer';
import { DefaultUser } from '@ada/microservice-common';
import { GroupStore } from '../../../components/ddb/groups';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { mocked } from 'ts-jest/utils';
import fetch, { Response } from 'node-fetch';
import jwkToPem from 'jwk-to-pem';
import jwt from 'jsonwebtoken';
import { TEST_REGION } from '@ada/cdk-core';

jest.mock('node-fetch');
jest.mock('@ada/jwt-signer');
jest.mock('jsonwebtoken');
jest.mock('jwk-to-pem');
jest.mock('fs');

const ISS = `https://cognito-idp.${TEST_REGION}.amazonaws.com/user-pool-id`

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

// Mock the api access policy to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('custom-authorizer-cognito-token', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const mockContext = {
    fail: jest.fn(),
  };

  const mockedVaidTokensVerificationWith = (accessTokenResult: any, idTokenResult: any) => {
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as unknown as jest.Mock)
      .mockReturnValueOnce(JSON.stringify({ keys: [{ kid: 'test-kid', any: 'prop' }] }))
      .mockReturnValueOnce(JSON.stringify({ keys: [{ kid: 'test-kid-id-token', any: 'prop-id-token' }] }));
    (jwkToPem as unknown as jest.Mock).mockReturnValueOnce('pem-output').mockReturnValueOnce('pem-output-id-token');
    jwt.decode = jest
      .fn()
      .mockReturnValueOnce({
        header: {
          kid: 'test-kid',
        },
      })
      .mockReturnValueOnce({
        header: {
          kid: 'test-kid-id-token',
        },
      });
    jwt.verify = jest.fn().mockReturnValueOnce(accessTokenResult).mockReturnValueOnce(idTokenResult);
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

  const validateJwkExecution = () => {
    expect(jwkToPem).toHaveBeenNthCalledWith(1, { any: 'prop', kid: 'test-kid' });
    expect(jwt.decode).toHaveBeenNthCalledWith(1, 'a-mock-token', { complete: true });
    expect(jwt.verify).toHaveBeenNthCalledWith(1, 'a-mock-token', 'pem-output');

    expect(jwkToPem).toHaveBeenNthCalledWith(2, { any: 'prop-id-token', kid: 'test-kid-id-token' });
    expect(jwt.decode).toHaveBeenNthCalledWith(2, 'a-mock-id-token', { complete: true });
    expect(jwt.verify).toHaveBeenNthCalledWith(2, 'a-mock-id-token', 'pem-output-id-token');
  };

  it.each([undefined, null, '', 'a-type', 'a-type '])(
    'should send unauthorized if token type or token is missing in the authorization field (%s)',
    async (token) => {
      await handler(
        {
          headers: {
            authorization: token,
          },
        } as unknown as CustomAuthorizerEventType,
        mockContext,
      );
      expect(mockContext.fail).toBeCalledWith('Unauthorized');
    },
  );

  it('should send unauthorized if token type is not supported', async () => {
    await handler(
      {
        headers: {
          authorization: 'UnsupportedType a-mock-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
  });

  it('should send unauthorized if the provided token cannot be decoded correctly', async () => {
    jwt.decode = jest.fn().mockReturnValueOnce(null);

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
  });

  it.each([
    ['any-iss', 'any-iss'],
    [ISS, 'any-iss'],
    ['any-iss', ISS],
  ])('should send unauthorized if the token issuer is not valid', async (accessTokenIss, idTokenIss) => {
    mockedVaidTokensVerificationWith(
      {
        iss: accessTokenIss,
      },
      {
        iss: idTokenIss,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');

    validateJwkExecution();
  });

  it.each([
    ['access', 'token'],
    ['token', 'id'],
  ])('should send unauthorized if the token_use is not valid', async (accessTokenUse, idTokenUse) => {
    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: accessTokenUse,
      },
      {
        iss: ISS,
        token_use: idTokenUse,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it.each([
    [1, 1],
    [1, Date.now() + 500],
    [Date.now() + 500, 1],
  ])('should send unauthorized if the token is expired', async (accessTokenExp, idTokenExp) => {
    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: accessTokenExp,
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: idTokenExp,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if x-user-id header is provided in the request', async () => {
    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
          'x-user-id': 'anything',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should send unauthorized if x-groups header is provided in the request', async () => {
    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
          'x-groups': 'anything',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should get an empty policy document if there are no configuration for the given group in the database', async () => {
    await generateGroup('reader', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1']);

    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
      },
    );

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.BEARER} a-mock-token`,
        [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin', 'x-user-id': 'any-username', 'x-username': 'any-username' },
      policyDocument: {
        Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: [] }],
        Version: '2012-10-17',
      },
      principalId: 'any-username',
    });
    validateJwkExecution();
  });

  it('should reject any user named the same as the system user', async () => {
    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
        'cognito:groups': [],
        username: DefaultUser.SYSTEM,
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
        'cognito:groups': [],
        username: DefaultUser.SYSTEM,
      },
    );

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    validateJwkExecution();
  });

  it('should get an proper policy document if all conditions are met and configuration is done correctly', async () => {
    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
      },
    );

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.BEARER} a-mock-token`,
        [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin', 'x-user-id': 'any-username', 'x-username': 'any-username' },
      policyDocument: {
        Statement: [
          { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['resource-3', 'resource-1', 'resource-2'] },
        ],
        Version: '2012-10-17',
      },
      principalId: 'any-username',
    });
    validateJwkExecution();
  });

  it.each([undefined, '', []])(
    'should get the default policy document if the user does not belong to any group (%s)',
    async (groups) => {
      await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
      await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
      await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

      mockedVaidTokensVerificationWith(
        {
          iss: ISS,
          token_use: 'access',
          exp: Date.now() + 500,
          'cognito:groups': groups,
          username: 'any-username',
        },
        {
          iss: ISS,
          token_use: 'id',
          exp: Date.now() + 500,
          'cognito:groups': groups,
          username: 'any-username',
        },
      );

      const result = await handler({
        headers: {
          authorization: `${AuthorizationType.BEARER} a-mock-token`,
          [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
        },
      } as unknown as CustomAuthorizerEventType);

      expect(result).toStrictEqual({
        context: { 'x-groups': '', 'x-user-id': 'any-username', 'x-username': 'any-username' },
        policyDocument: {
          Statement: [
            { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['default-access1', 'default-access2'] },
          ],
          Version: '2012-10-17',
        },
        principalId: 'any-username',
      });
      validateJwkExecution();
    },
  );

  it('should get an proper policy document with preferred_username as principal if provided in the id token', async () => {
    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
        'cognito:groups': ['admin'],
        username: 'any-username',
        preferred_username: 'new-principal',
      },
    );

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.BEARER} a-mock-token`,
        [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin', 'x-user-id': 'new-principal', 'x-username': 'any-username' },
      policyDocument: {
        Statement: [
          { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['resource-3', 'resource-1', 'resource-2'] },
        ],
        Version: '2012-10-17',
      },
      principalId: 'new-principal',
    });
    validateJwkExecution();
  });

  it('should allow for groups with overlapping api access policies', async () => {
    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGroup('reader', ['access-policy-1']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    mockedVaidTokensVerificationWith(
      {
        iss: ISS,
        token_use: 'access',
        exp: Date.now() + 500,
        'cognito:groups': ['admin', 'reader'],
        username: 'any-username',
      },
      {
        iss: ISS,
        token_use: 'id',
        exp: Date.now() + 500,
        'cognito:groups': ['admin', 'reader'],
        username: 'any-username',
      },
    );

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.BEARER} a-mock-token`,
        [AdditionalHeaders.ID_TOKEN]: 'a-mock-id-token',
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin,reader', 'x-user-id': 'any-username', 'x-username': 'any-username' },
      policyDocument: {
        Statement: [
          { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['resource-3', 'resource-1', 'resource-2'] },
        ],
        Version: '2012-10-17',
      },
      principalId: 'any-username',
    });
    validateJwkExecution();
  });

  describe('getJwk', () => {
    const mockFetch = mocked(fetch, true);

    it('should return the jwk content from the filesystem if it has been cached', async () => {
      (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as unknown as jest.Mock).mockReturnValue(
        JSON.stringify({ keys: [{ kid: 'test-kid', any: 'prop' }] }),
      );

      const result = await getJwk('test-kid');

      expect(result).toStrictEqual({
        any: 'prop',
        kid: 'test-kid',
      });
      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/jwk.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/jwk.json', 'utf-8');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should request the jwk remotely and cache it in the filesystem if the cache is empty', async () => {
      const remoteOutput = JSON.stringify({
        keys: [
          {
            any: 'prop',
            kid: 'test-kid',
          },
        ],
      });
      const outputMock = jest.fn().mockReturnValue(remoteOutput);

      mockFetch.mockResolvedValue({ status: 200, text: outputMock as any } as Response);
      (fs.existsSync as unknown as jest.Mock).mockReturnValue(false);
      (fs.writeFileSync as unknown as jest.Mock).mockReturnValue('');

      const result = await getJwk('test-kid');

      expect(result).toStrictEqual({
        any: 'prop',
        kid: 'test-kid',
      });
      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/jwk.json');
      expect(fs.readFileSync).not.toHaveBeenCalledWith('/tmp/jwk.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/jwk.json', remoteOutput, 'utf-8');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://cognito-idp.${TEST_REGION}.amazonaws.com/user-pool-id/.well-known/jwks.json`,
      );
    });
  });
});
