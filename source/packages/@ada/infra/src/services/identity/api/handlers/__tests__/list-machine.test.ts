/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { ListMachinesResponse, MachineStore } from '../../../../api/components/ddb/machine-provider';
import { Machine } from '@ada/microservice-common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-machine';

const testMachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

describe('list-machine', () => {
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
  const listMachineHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
    newUserId?: string,
    newGroups?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
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

  const generateMachine = (machineId: string) =>
    testMachineStore.putMachine(machineId, 'test-user', {
      description: 'machine description',
    });

  it('should list all available machines without limit', async () => {
    let response = await listMachineHandler();
    let body = JSON.parse(response.body) as ListMachinesResponse;

    expect(response.statusCode).toBe(200);
    expect(body.machines).toBeArrayOfSize(0);
    expect(body).not.toHaveProperty('nextToken');

    await Promise.all([
      generateMachine('machine-id-1'),
      generateMachine('machine-id-2'),
      generateMachine('machine-id-3'),
      generateMachine('machine-id-4'),
    ]);

    response = await listMachineHandler();
    body = JSON.parse(response.body) as ListMachinesResponse;
    expect(response.statusCode).toBe(200);
    expect(body.machines).toBeArrayOfSize(4);
    expect(body.machines.map((o: Machine) => o.machineId)).toIncludeSameMembers([
      'machine-id-1',
      'machine-id-2',
      'machine-id-3',
      'machine-id-4',
    ]);

    expect(body).not.toHaveProperty('nextToken');
  });

  it('should list machine when limit parameter is provided', async () => {
    await Promise.all([
      generateMachine('machine-id-1'),
      generateMachine('machine-id-2'),
      generateMachine('machine-id-3'),
      generateMachine('machine-id-4'),
    ]);

    let response = await listMachineHandler({ limit: '3' });
    let body = JSON.parse(response.body) as ListMachinesResponse;

    expect(response.statusCode).toBe(200);
    expect(body.machines).toBeArrayOfSize(3);
    expect(body).not.toHaveProperty('nextToken');

    response = await listMachineHandler({ limit: '5' });
    body = JSON.parse(response.body) as ListMachinesResponse;

    expect(response.statusCode).toBe(200);
    expect(body.machines).toBeArrayOfSize(4);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should paginate machine based on parameters', async () => {
    await Promise.all([
      generateMachine('machine-id-1'),
      generateMachine('machine-id-2'),
      generateMachine('machine-id-3'),
      generateMachine('machine-id-4'),
    ]);

    let response = await listMachineHandler({ pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(firstPage.machines).toBeArrayOfSize(3);

    response = await listMachineHandler({ pageSize: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(secondPage.machines).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect([...firstPage.machines, ...secondPage.machines].map((o: Machine) => o.machineId)).toIncludeSameMembers([
      'machine-id-1',
      'machine-id-2',
      'machine-id-3',
      'machine-id-4',
    ]);
  });

  it('should paginate machine based on parameters when limit is applied', async () => {
    await Promise.all([
      generateMachine('machine-id-1'),
      generateMachine('machine-id-2'),
      generateMachine('machine-id-3'),
      generateMachine('machine-id-4'),
    ]);

    let response = await listMachineHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(firstPage.machines).toBeArrayOfSize(2);

    response = await listMachineHandler({ pageSize: '2', limit: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(secondPage.machines).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await Promise.all([
      generateMachine('machine-id-1'),
      generateMachine('machine-id-2'),
      generateMachine('machine-id-3'),
      generateMachine('machine-id-4'),
    ]);

    let response = await listMachineHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(firstPage.machines).toBeArrayOfSize(2);

    // Limit in the second request should be ignored
    response = await listMachineHandler({ pageSize: '2', limit: '9999', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListMachinesResponse;
    expect(secondPage.machines).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should return 400 when given an invalid nextToken', async () => {
    const response = await listMachineHandler({ nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    const response = await listMachineHandler({ limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    const response = await listMachineHandler({ pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 403 if the creator of the machine is not the same as the caller', async () => {
    await generateMachine('machine-id-1');

    const response = await listMachineHandler({}, 'another-user', 'default');

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("You don't have access to list all the machine");
  });

  it('should list the machine if the caller is an admin', async () => {
    await generateMachine('machine-id-1');

    const response = await listMachineHandler({}, 'another-admin', 'admin,default,power-user');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).machines).toBeArrayOfSize(1);
  });
});
