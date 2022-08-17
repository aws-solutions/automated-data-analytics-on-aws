/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { Token } from '@ada/microservice-common';
import { TokenStore } from '../../../../api/components/ddb/token-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../delete-token';

const testTokenStore: TokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

const deleteUserPoolClientMock = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    deleteUserPoolClient: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(deleteUserPoolClientMock(...args))),
    }),
  })),
}));

describe('delete-token', () => {
  const now = '2021-01-01T00:00:00.000Z';

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
  const deleteTokenHandler = (
    machineId: string,
    tokenId: string,
    newUserId?: string,
    newGroups?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { machineId, tokenId },
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

  it('should delete a token if exists', async () => {
    deleteUserPoolClientMock.mockReturnValue({});
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;

    await testTokenStore.putToken('machine-id-1', 'token-1', 'test-user', token);
    await testTokenStore.putToken('machine-id-2', 'token-2', 'test-user', token);

    const expectedmachine = {
      ...token,
      machineId: 'machine-id-1',
      tokenId: 'token-1',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await deleteTokenHandler('machine-id-1', 'token-1');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);

    expect(await testTokenStore.getToken('machine-id-1', 'token-1')).toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-2', 'token-2')).not.toBe(undefined);
    expect(deleteUserPoolClientMock).toHaveBeenCalled();
  });

  it('should return 404 if the token does not exist', async () => {
    const response = await deleteTokenHandler('machine-id-does-not-exist', 'token-does-not-exist');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('machine-id-does-not-exist');
    expect(response.body).toContain('token-does-not-exist');
    expect(deleteUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should NOT delete a token if the creator is not the same', async () => {
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;

    await testTokenStore.putToken('machine-id-1', 'token-1', 'test-user', token);
    await testTokenStore.putToken('machine-id-2', 'token-2', 'test-user', token);

    const response = await deleteTokenHandler('machine-id-1', 'token-1', 'another-user', 'default,power-user');

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).message).toBe(
      "You don't have permissions to delete the token for machine machine-id-1 with id token-1",
    );
    expect(deleteUserPoolClientMock).not.toHaveBeenCalled();
  });

  it('should delete a token if caller is an admin', async () => {
    deleteUserPoolClientMock.mockReturnValue({});
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;

    await testTokenStore.putToken('machine-id-1', 'token-1', 'test-user', token);

    const response = await deleteTokenHandler('machine-id-1', 'token-1', 'another-admin', 'admin,default,power-user');

    expect(response.statusCode).toBe(200);
    expect(deleteUserPoolClientMock).toHaveBeenCalled();
  });
});
