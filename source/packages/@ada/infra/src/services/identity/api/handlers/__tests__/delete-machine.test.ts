/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { Machine, Token } from '@ada/microservice-common';
import { MachineStore } from '../../../../api/components/ddb/machine-provider';
import { TokenStore } from '../../../../api/components/ddb/token-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../delete-machine';

const testMachineStore: MachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

const testTokenStore: TokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

describe('delete-machine', () => {
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
  const deleteMachineHandler = (
    machineId: string,
    newUserId?: string,
    newGroups?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { machineId },
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

  it('should delete a machine if the machineId exists', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;

    await testMachineStore.putMachine('machine-id-1', 'test-user', machine);
    await testMachineStore.putMachine('machine-id-2', 'test-user', machine);
    await testTokenStore.putToken('machine-id-2', 'token-1', 'test-user', token);

    const expectedmachine = {
      ...machine,
      machineId: 'machine-id-1',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await deleteMachineHandler('machine-id-1');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);

    expect(await testMachineStore.getMachine('machine-id-1')).toBe(undefined);
    expect(await testMachineStore.getMachine('machine-id-2')).not.toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-2', 'token-1')).not.toBe(undefined);
  });

  it('should delete a machine and its tokens', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;

    const token = {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abc',
    } as Token;

    // Create our new machine
    await testMachineStore.putMachine('machine-id-1', 'test-user', machine);
    await testMachineStore.putMachine('machine-id-2', 'test-user', machine);
    await testTokenStore.putToken('machine-id-1', 'token-1', 'test-user', token);
    await testTokenStore.putToken('machine-id-1', 'token-2', 'test-user', token);
    await testTokenStore.putToken('machine-id-1', 'token-3', 'test-user', token);
    await testTokenStore.putToken('machine-id-2', 'token-4', 'test-user', token);

    const expectedmachine = {
      ...machine,
      machineId: 'machine-id-1',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await deleteMachineHandler('machine-id-1');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);

    expect(await testMachineStore.getMachine('machine-id-1')).toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-1', 'token-1')).toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-1', 'token-2')).toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-1', 'token-3')).toBe(undefined);
    expect(await testMachineStore.getMachine('machine-id-2')).not.toBe(undefined);
    expect(await testTokenStore.getToken('machine-id-2', 'token-4')).not.toBe(undefined);
  });

  it('should return 404 if machineId does not exist', async () => {
    const response = await deleteMachineHandler('machine-id-does-not-exist');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('machine-id-does-not-exist');
  });

  it('should NOT delete a machine if belongs to another user', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    await testMachineStore.putMachine('machine-id-1', 'test-user', machine);

    const response = await deleteMachineHandler('machine-id-1', 'another-user', 'default,power-user');

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("You don't have permissions to delete the machine with id machine-id-1");
  });

  it('should delete the machine if the calling user is an admin', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    await testMachineStore.putMachine('machine-id-1', 'test-user', machine);

    const response = await deleteMachineHandler('machine-id-1', 'another-admin', 'admin,default,power-user');

    expect(response.statusCode).toBe(200);
  });
});
