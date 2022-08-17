/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as jwtSigner from '@ada/jwt-signer';
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { AuthorizationType } from '@ada/common';
import { CustomAuthorizerEventType, handler } from '../custom-authorizer';
import { DefaultUser } from '@ada/microservice-common';
import { GroupStore } from '../../../components/ddb/groups';
import { VError } from 'verror';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import jwt from 'jsonwebtoken';

const adminGetUserMock = jest.fn();
const signJwt = jest
  .fn()
  .mockImplementation((payload, exp) =>
    jwt.sign(payload, 'secret', { expiresIn: Math.floor((exp.getTime() - Date.now()) / 1000) }),
  );

jest.mock('@ada/jwt-signer');
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    adminGetUser: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(adminGetUserMock(...args))),
    }),
  })),
}));
const tokenDuration = 3600 * 10 * 1000;

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

// Mock the api access policy to point to our local dynamodb
const testApiAccessPolicyStore = new (ApiAccessPolicyStore as any)(getLocalDynamoDocumentClient());
ApiAccessPolicyStore.getInstance = jest.fn(() => testApiAccessPolicyStore);

describe('custom-authorizer-internal-token', () => {
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

  const generateGroup = (groupId: string, apiAccessPolicyIds: string[]) =>
    testGroupStore.putGroup(groupId, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds,
    });

  const mockVerifyToken = (payload: any, expiration: Date) =>
    jest.spyOn(jwtSigner, 'verifyJwt').mockResolvedValue({
      ...payload,
      exp: Math.floor(expiration.getTime() / 1000),
    });

  const generateGeneratedApiAccessPolicy = (apiAccessPolicyId: string, resources: string[]) =>
    testApiAccessPolicyStore.putApiAccessPolicy(apiAccessPolicyId, 'test-user', {
      name: 'test name',
      description: 'test description',
      resources,
    });

  it('should send unauthorized if the provided token is not correct', async () => {
    jest.spyOn(jwtSigner, 'verifyJwt').mockImplementation(() => {
      throw new VError({ name: 'InvalidTokenError' }, 'invalid token');
    });

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.INTERNAL_TOKEN} a-fake-token`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
  });

  it('should send unauthorized if the provided token is expired', async () => {
    const payload = { userId: 'a', username: 'u', groups: ['b'] };
    const expiration = new Date(Date.now() - 1);
    const token = await signJwt(payload, expiration);
    mockVerifyToken(payload, expiration);

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.INTERNAL_TOKEN} ${token}`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    expect(jwtSigner.verifyJwt).toBeCalledWith(token, jwtSigner.TokenType.INTERNAL);
  });

  it.each([
    ['userId', undefined],
    ['groups', undefined],
    ['username', undefined],
    ['userId', ''],
    ['groups', ''],
    ['username', ''],
    ['groups', []],
  ])('should send unauthorized if the provided token does not have the required information', async (key, value) => {
    const payload = { userId: 'a', username: 'u', groups: ['b'], [key]: value };
    const expiration = new Date(Date.now() + tokenDuration);
    const token = await signJwt(payload, expiration);
    mockVerifyToken(payload, expiration);

    await handler(
      {
        headers: {
          authorization: `${AuthorizationType.INTERNAL_TOKEN} ${token}`,
        },
      } as unknown as CustomAuthorizerEventType,
      mockContext,
    );
    expect(mockContext.fail).toBeCalledWith('Unauthorized');
    expect(jwtSigner.verifyJwt).toBeCalledWith(token, jwtSigner.TokenType.INTERNAL);
  });

  it('should return an empty policy document if the user is not mapped to a configured group', async () => {
    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    const payload = { userId: 'test-user', username: 'usr', groups: ['reader'] };
    const expiration = new Date(Date.now() + tokenDuration);
    const token = await signJwt(payload, expiration);
    mockVerifyToken(payload, expiration);

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.INTERNAL_TOKEN} ${token}`,
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
    expect(jwtSigner.verifyJwt).toBeCalledWith(token, jwtSigner.TokenType.INTERNAL);
  });

  it('should allow the system user to call any api', async () => {
    const payload = { userId: DefaultUser.SYSTEM, username: DefaultUser.SYSTEM, groups: [DefaultUser.SYSTEM] };
    const expiration = new Date(Date.now() + tokenDuration);
    const token = await signJwt(payload, expiration);
    mockVerifyToken(payload, expiration);

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.INTERNAL_TOKEN} ${token}`,
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': DefaultUser.SYSTEM, 'x-username': DefaultUser.SYSTEM, 'x-user-id': DefaultUser.SYSTEM },
      policyDocument: {
        Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['*'] }],
        Version: '2012-10-17',
      },
      principalId: DefaultUser.SYSTEM,
    });
    expect(jwtSigner.verifyJwt).toBeCalledWith(token, jwtSigner.TokenType.INTERNAL);
  });

  it('should return the expected policy if the user is mapped correctly', async () => {
    await generateGroup('admin', ['access-policy-1', 'access-policy-2']);
    await generateGeneratedApiAccessPolicy('access-policy-1', ['resource-1', 'resource-2']);
    await generateGeneratedApiAccessPolicy('access-policy-2', ['resource-3', 'resource-3']);

    const payload = { userId: 'test-user', username: 'usr', groups: ['admin'] };
    const expiration = new Date(Date.now() + tokenDuration);
    const token = await signJwt(payload, expiration);
    mockVerifyToken(payload, expiration);

    const result = await handler({
      headers: {
        authorization: `${AuthorizationType.INTERNAL_TOKEN} ${token}`,
      },
    } as unknown as CustomAuthorizerEventType);

    expect(result).toStrictEqual({
      context: { 'x-groups': 'admin', 'x-username': 'usr', 'x-user-id': 'test-user' },
      policyDocument: {
        Statement: [
          { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: ['resource-3', 'resource-1', 'resource-2'] },
        ],
        Version: '2012-10-17',
      },
      principalId: 'test-user',
    });
    expect(jwtSigner.verifyJwt).toBeCalledWith(token, jwtSigner.TokenType.INTERNAL);
  });
});
