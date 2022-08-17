/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { Machine } from '@ada/microservice-common';
import { MachineStore } from '../../../../api/components/ddb/machine-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-machine';

const testMachineStore: MachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

describe('get-machine', () => {
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
  const getMachineHandler = (
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

  it('should return a machine if the machineId exists', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    // Create our new machine
    await testMachineStore.putMachine('machine-id', 'test-user', machine);

    const expectedmachine = {
      ...machine,
      machineId: 'machine-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await getMachineHandler('machine-id');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);
  });

  it('should return 403 if the machine does not belong to the same user', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    // Create our new machine
    await testMachineStore.putMachine('machine-id', 'test-user', machine);
    const response = await getMachineHandler('machine-id', 'another-user', 'default');

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).message).toEqual("You don't have access to the requested machine machine-id");
  });

  it('should return a machine if the caller has admin rights', async () => {
    const machine = {
      description: 'a test machine',
    } as Machine;
    // Create our new machine
    await testMachineStore.putMachine('machine-id', 'test-user', machine);

    const expectedmachine = {
      ...machine,
      machineId: 'machine-id',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await getMachineHandler('machine-id', 'another-admin', 'admin,default,power-user');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedmachine);
  });

  it('should return 404 if machineId does not exist', async () => {
    const response = await getMachineHandler('machine-id-does-not-exist');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('machine-id-does-not-exist');
  });
});
