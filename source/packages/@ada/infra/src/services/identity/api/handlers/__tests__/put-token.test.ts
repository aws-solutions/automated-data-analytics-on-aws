/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys, addDays } from '@ada/common';
import { Machine, Token } from '@ada/microservice-common';
import { MachineStore } from '../../../../api/components/ddb/machine-provider';
import { TokenStore } from '../../../../api/components/ddb/token-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../put-token';

const testTokenStore: TokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

const testMachineStore: MachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

const createUserPoolClientMock = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    createUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(createUserPoolClientMock(...args))),
    }),
  })),
}));

const now = '2021-01-01T00:00:00.000Z';
const before = '2020-12-31T23:59:59.000Z';
const tokenDuration = new Date(new Date(now).getTime() + 3600 * 10 * 1000).toISOString(); // 10 hours

const testMachine = {
  description: 'a test machine',
} as Machine;

describe('put-token', () => {
  const now = new Date().toISOString();
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
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putTokenHandler = (
    machineId: string,
    tokenId: string,
    token: Omit<Token, 'machineId' | 'tokenId'>,
    newUserId?: string,
    newGroups?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { machineId, tokenId },
        body: JSON.stringify(token),
        ...(newUserId && newGroups
          ? {
              requestContext: {
                authorizer: {
                  [CallerDetailsKeys.USER_ID]: newUserId,
                  [CallerDetailsKeys.USERNAME]: `${newUserId}@usr.example.com`,
                  [CallerDetailsKeys.GROUPS]: newGroups,
                },
              },
            }
          : {}),
      }),
      null,
    );

  it('should write the token data in the database, store the clientId and return secret+jwt', async () => {
    const clientId = 'a-client';
    const clientSecret = 'a-secret';
    createUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        ClientId: clientId,
        ClientSecret: clientSecret,
      },
    });
    const token = {
      enabled: true,
      expiration: tokenDuration,
    } as Token;

    await testMachineStore.putMachine('machine-id', 'test-user', testMachine);
    const response = await putTokenHandler('machine-id', 'token-id', token);
    const expectedToken = {
      ...token,
      ...createUpdateDetails,
      username: 'test-user@usr.example.com',
      machineId: 'machine-id',
      tokenId: 'token-id',
    } as Token;
    const responseToken = JSON.parse(response.body) as Token;
    const storedToken = await testTokenStore.getToken('machine-id', 'token-id');

    expect(response.statusCode).toBe(200);
    expect(responseToken).toEqual({
      ...expectedToken,
      enabled: true,
      expiration: tokenDuration,
      clientSecret,
      clientId,
      authToken: Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      authUrl: expect.any(String),
    });
    expect(storedToken).toEqual({
      ...expectedToken,
      tokenId: 'token-id',
      enabled: true,
      expiration: tokenDuration,
      clientId,
      authToken: undefined,
      authUrl: undefined,
      clientSecret: undefined,
    });
    expect(Buffer.from(responseToken.authToken!, 'base64').toString('utf-8')).toEqual(`${clientId}:${clientSecret}`);
  });

  it('should create and update a token', async () => {
    const clientId = 'a-client';
    const clientSecret = 'a-secret';
    createUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        ClientId: clientId,
        ClientSecret: clientSecret,
      },
    });

    const token = {
      enabled: true,
      expiration: tokenDuration,
    } as Token;

    await testMachineStore.putMachine('machine-id', 'test-user', testMachine);
    const response = await putTokenHandler('machine-id', 'token-id', token);
    const expectedToken = {
      ...token,
      ...createUpdateDetails,
      username: 'test-user@usr.example.com',
      machineId: 'machine-id',
      tokenId: 'token-id',
    } as Token;
    const responseToken = JSON.parse(response.body) as Token;
    const storedToken = await testTokenStore.getToken('machine-id', 'token-id');

    expect(response.statusCode).toBe(200);
    expect(responseToken).toEqual({
      ...expectedToken,
      authToken: expect.any(String),
      clientSecret,
      clientId,
      authUrl: expect.any(String),
    });
    expect(storedToken).toEqual({
      ...responseToken,
      authToken: undefined,
      clientSecret: undefined,
      authUrl: undefined,
      clientId,
    });

    const updateToken = {
      enabled: false,
      expiration: tokenDuration,
      updatedTimestamp: responseToken.updatedTimestamp,
    } as Token;

    const updateResponse = await putTokenHandler('machine-id', 'token-id', updateToken);
    const expectedUpdatedToken = {
      ...updateToken,
      ...createUpdateDetails,
      username: 'test-user@usr.example.com',
      machineId: 'machine-id',
      tokenId: 'token-id',
      clientId,
      authUrl: expect.any(String),
    };

    expect(updateResponse.statusCode).toBe(200);
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedToken);
    expect(await testTokenStore.getToken('machine-id', 'token-id')).toEqual({
      ...expectedUpdatedToken,
      authToken: undefined,
      clientSecret: undefined,
      authUrl: undefined,
    });

    expect(createUserPoolClientMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT create a token if there are already 5 tokens in the machine', async () => {
    createUserPoolClientMock.mockReturnValue({});
    await testMachineStore.putMachine('machine-id-1', 'test-user', testMachine);

    const token = {
      enabled: true,
      expiration: tokenDuration,
      clientId: 'abc',
    } as Token;
    for (let idx = 1; idx <= 5; idx++) {
      await testTokenStore.putToken('machine-id-1', `token-${idx}`, 'test-user', token);
    }

    const response = await putTokenHandler('machine-id-1', 'token-id', token);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('machine-id-1');
    expect(response.body).toContain('token-id');
    expect(response.body).toContain('max number of token allowed per machine (5)');
    expect(createUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should NOT create a token if the provided machine does not exists', async () => {
    await testMachineStore.putMachine('any-machine-id', 'test-user', testMachine);

    const token = {
      enabled: true,
      expiration: tokenDuration,
      clientId: 'abc',
    } as Token;

    const response = await putTokenHandler('machine-id', 'token-id', token);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('machine-id does not exists');
    expect(createUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should NOT create a token if the expiration date is too far in the future', async () => {
    await testMachineStore.putMachine('machine-id-1', 'test-user', testMachine);

    const token = {
      enabled: true,
      expiration: addDays(Date.now(), 400).toISOString(),
      clientId: 'abc',
    } as Token;

    const response = await putTokenHandler('machine-id-1', 'token-id', token);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('machine-id-1');
    expect(response.body).toContain('token-id');
    expect(response.body).toContain('it can only be maximum 365 days in the future');
    expect(createUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should NOT create a token if the machine belongs to another user', async () => {
    await testMachineStore.putMachine('machine-id-1', 'test-user', testMachine);

    const token = {
      enabled: true,
      expiration: addDays(Date.now(), 400).toISOString(),
      clientId: 'abc',
    } as Token;

    const response = await putTokenHandler('machine-id-1', 'token-id', token, 'another-user', 'default,power-user');

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('machine-id-1');
    expect(response.body).toContain("You don't have access to create token for the machine");
    expect(createUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should NOT create a token if same token id exists', async () => {
    const clientId = 'a-client';
    const clientSecret = 'a-secret';
    createUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        ClientId: clientId,
        ClientSecret: clientSecret,
      },
    });

    const token = {
      enabled: true,
      expiration: tokenDuration,
    } as Token;

    await testMachineStore.putMachine('machine-id', 'test-user', testMachine);
    const response = await putTokenHandler('machine-id', 'token-id', token);
    const expectedToken = {
      ...token,
      ...createUpdateDetails,
      username: 'test-user@usr.example.com',
      machineId: 'machine-id',
      tokenId: 'token-id',
    } as Token;
    const responseToken = JSON.parse(response.body) as Token;
    const storedToken = await testTokenStore.getToken('machine-id', 'token-id');

    expect(response.statusCode).toBe(200);
    expect(responseToken).toEqual({
      ...expectedToken,
      clientSecret,
      clientId,
      authToken: expect.any(String),
      authUrl: expect.any(String),
    });
    expect(storedToken).toEqual({
      ...responseToken,
      authToken: undefined,
      authUrl: undefined,
      clientSecret: undefined,
      clientId,
    });

    const duplicateToken = {
      enabled: true,
    } as Token;

    const updateResponse = await putTokenHandler('machine-id', 'token-id', duplicateToken);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body).message).toContain('Item with same id already exists');

    expect(createUserPoolClientMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT update a token if updatedTimestamp does not match', async () => {
    const clientId = 'a-client';
    const clientSecret = 'a-secret';
    createUserPoolClientMock.mockReturnValue({
      UserPoolClient: {
        ClientId: clientId,
        ClientSecret: clientSecret,
      },
    });

    const token = {
      enabled: true,
      expiration: tokenDuration,
    } as Token;

    await testMachineStore.putMachine('machine-id', 'test-user', testMachine);
    const response = await putTokenHandler('machine-id', 'token-id', token);
    const expectedToken = {
      ...token,
      ...createUpdateDetails,
      username: 'test-user@usr.example.com',
      machineId: 'machine-id',
      tokenId: 'token-id',
    } as Token;
    const responseToken = JSON.parse(response.body) as Token;
    const storedToken = await testTokenStore.getToken('machine-id', 'token-id');

    expect(response.statusCode).toBe(200);
    expect(responseToken).toEqual({
      ...expectedToken,
      clientSecret,
      clientId,
      authToken: expect.any(String),
      authUrl: expect.any(String),
    });
    expect(storedToken).toEqual({
      ...responseToken,
      authToken: undefined,
      clientSecret: undefined,
      authUrl: undefined,
      clientId,
    });

    const updateToken = {
      enabled: false,
      updatedTimestamp: before,
    } as Token;

    const updateResponse = await putTokenHandler('machine-id', 'token-id', updateToken);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body).message).toContain('cannot be updated');

    expect(createUserPoolClientMock).toHaveBeenCalledTimes(1);
  });
});
