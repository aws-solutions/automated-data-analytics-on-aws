/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { Token } from '@ada/microservice-common';
import { TokenStore } from '../../../../api/components/ddb/token-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-token';

const testTokenStore: TokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

describe('get-token', () => {
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
  const getTokenHandler = (
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

  it('should return a token if it exists', async () => {
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', token);

    const expectedmachine = {
      ...token,
      machineId: 'machine-id',
      tokenId: 'token-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      secret: undefined,
    };

    const response = await getTokenHandler('machine-id', 'token-id');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);
  });

  it('should return 403 if the token does not belong to the same user', async () => {
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', token);

    const response = await getTokenHandler('machine-id', 'token-id', 'another-user', 'default');

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).message).toEqual(
      "You don't have access to the requested token token-id for machine machine-id",
    );
  });

  it('should return the token if the caller has admin rights', async () => {
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;
    await testTokenStore.putToken('machine-id', 'token-id', 'test-user', token);

    const expectedmachine = {
      ...token,
      machineId: 'machine-id',
      tokenId: 'token-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      secret: undefined,
    };

    const response = await getTokenHandler('machine-id', 'token-id', 'another-admin', 'admin,default,power-user');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);
  });

  it('should return 404 if the token does not exist', async () => {
    const response = await getTokenHandler('machine-id-does-not-exist', 'token-does-not-exists');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('machine-id-does-not-exist');
    expect(response.body).toContain('token-does-not-exists');
  });
});
