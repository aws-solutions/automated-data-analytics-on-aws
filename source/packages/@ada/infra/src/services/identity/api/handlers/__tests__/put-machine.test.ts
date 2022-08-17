/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import {
  DEFAULT_CALLER,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { Machine } from '@ada/microservice-common';
import { MachineStore } from '../../../../api/components/ddb/machine-provider';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-machine';

const testMachineStore: MachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

describe('put-machine', () => {
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
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putMachineHandler = (
    machineId: string,
    machine: Omit<Machine, 'machineId'>,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { machineId },
        body: machine,
      }) as any,
      null,
    );

  it.each(['machine-creator', DefaultGroupIds.ADMIN])(
    'should create and update a machine as %s',
    async (updatingUserId) => {
      const machine = {
        description: 'test description',
      } as Machine;

      const response = await putMachineHandler('machine-id', machine, {
        ...DEFAULT_CALLER,
        userId: 'machine-creator',
        groups: ['analyst'],
      });
      const expectedMachine = {
        ...machine,
        ...createUpdateDetails,
        createdBy: 'machine-creator',
        updatedBy: 'machine-creator',
        machineId: 'machine-id',
      } as Machine;
      const responseMachine = JSON.parse(response.body) as Machine;
      const storedMachine = await testMachineStore.getMachine('machine-id');

      expect(response.statusCode).toBe(200);
      expect(responseMachine).toEqual(expectedMachine);
      expect(storedMachine).toEqual(responseMachine);

      const updatedMachine = {
        description: 'new description',
        updatedTimestamp: responseMachine.updatedTimestamp,
      } as Machine;

      const updateResponse = await putMachineHandler('machine-id', updatedMachine, {
        ...DEFAULT_CALLER,
        userId: updatingUserId,
        groups: [updatingUserId],
      });
      const expectedUpdatedMachine = {
        ...updatedMachine,
        ...createUpdateDetails,
        createdBy: 'machine-creator',
        updatedBy: updatingUserId,
        machineId: 'machine-id',
      };

      expect(updateResponse.statusCode).toBe(200);
      expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedMachine);
      expect(await testMachineStore.getMachine('machine-id')).toEqual({
        ...expectedUpdatedMachine,
      });
    },
  );

  it('should forbid updating a machine when the updater is not the owner', async () => {
    const machine = {
      description: 'test description',
    } as Machine;

    const response = await putMachineHandler('machine-id', machine, {
      ...DEFAULT_CALLER,
      userId: 'machine-creator',
      groups: ['analyst'],
    });
    expect(response.statusCode).toBe(200);

    const updatedResponse = await putMachineHandler('machine-id', machine, {
      ...DEFAULT_CALLER,
      userId: 'unauthorized-user',
      groups: ['analyst'],
    });
    expect(updatedResponse.statusCode).toBe(403);
  });

  it('should NOT create a machine with the same name as an existing item', async () => {
    const machine = {
      description: 'test description',
    } as Machine;

    const response = await putMachineHandler('machine-id', machine);
    const expectedMachine = {
      ...machine,
      ...createUpdateDetails,
      machineId: 'machine-id',
    } as Machine;
    const responseMachine = JSON.parse(response.body) as Machine;
    const storedMachine = await testMachineStore.getMachine('machine-id');

    expect(response.statusCode).toBe(200);
    expect(responseMachine).toEqual(expectedMachine);
    expect(storedMachine).toEqual(responseMachine);

    const duplicateMachine = {
      ...machine,
      machineId: 'machine-id',
    } as Machine;

    const duplicateResponse = await putMachineHandler('machine-id', duplicateMachine);
    expect(duplicateResponse.statusCode).toBe(400);
    expect(JSON.parse(duplicateResponse.body).message).toBeDefined();
    expect(JSON.parse(duplicateResponse.body)?.message).toContain('Item with same id already exists');
  });

  it('should NOT update a machine if updatedTimestamp does not match', async () => {
    const machine = {
      description: 'test description',
    } as Machine;

    const response = await putMachineHandler('machine-id', machine);
    const expectedMachine = {
      ...machine,
      ...createUpdateDetails,
      machineId: 'machine-id',
    } as Machine;
    const responseMachine = JSON.parse(response.body) as Machine;
    const storedMachine = await testMachineStore.getMachine('machine-id');

    expect(response.statusCode).toBe(200);
    expect(responseMachine).toEqual(expectedMachine);
    expect(storedMachine).toEqual(responseMachine);

    const updatedMachine = {
      description: 'new description',
      updatedTimestamp: before,
    } as Machine;

    const updateResponse = await putMachineHandler('machine-id', updatedMachine);
    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toBeDefined();
    expect(JSON.parse(updateResponse.body)?.message).toContain('cannot be updated');
  });
});
