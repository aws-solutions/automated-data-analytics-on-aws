/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';
import { ListTokenResponse, TokenStore } from '../../../../api/components/ddb/token-provider';
import { MachineStore } from '../../../../api/components/ddb/machine-provider';
import { Token } from '@ada/microservice-common';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-token';

const testTokenStore = new (TokenStore as any)(getLocalDynamoDocumentClient());
TokenStore.getInstance = jest.fn(() => testTokenStore);

const testMachineStore = new (MachineStore as any)(getLocalDynamoDocumentClient());
MachineStore.getInstance = jest.fn(() => testMachineStore);

describe('list-token', () => {
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
  const listTokenHandler = (
    machineId: string,
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
    newUserId?: string,
    newGroups?: string,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { machineId },
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
  const generateToken = (machineId: string, tokenId: string) =>
    testTokenStore.putToken(machineId, tokenId, 'test-user', {
      enabled: true,
      expiration: new Date().toISOString(),
      clientId: 'abcd',
    } as Token);

  it('should list all available tokens without limit', async () => {
    await generateMachine('machine-id');
    let response = await listTokenHandler('machine-id');
    let body = JSON.parse(response.body) as ListTokenResponse;

    expect(response.statusCode).toBe(200);
    expect(body.tokens).toBeArrayOfSize(0);
    expect(body).not.toHaveProperty('nextToken');

    await generateMachine('machine-id-1');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-1', 'token-id-3'),
      generateToken('machine-id-1', 'token-id-4'),
    ]);

    response = await listTokenHandler('machine-id-1');
    body = JSON.parse(response.body) as ListTokenResponse;
    expect(response.statusCode).toBe(200);
    expect(body.tokens).toBeArrayOfSize(4);
    expect(body.tokens.map((o: Token) => o.machineId)).toIncludeSameMembers([
      'machine-id-1',
      'machine-id-1',
      'machine-id-1',
      'machine-id-1',
    ]);
    expect(body.tokens.map((o: Token) => o.tokenId)).toIncludeSameMembers([
      'token-id-1',
      'token-id-2',
      'token-id-3',
      'token-id-4',
    ]);

    expect(body).not.toHaveProperty('nextToken');
  });

  it('should list all tokens belonging to one machine without limit', async () => {
    await generateMachine('machine-id-1');
    await generateMachine('machine-id-2');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-2', 'token-id-3'),
      generateToken('machine-id-2', 'token-id-4'),
    ]);

    const response = await listTokenHandler('machine-id-1');
    const body = JSON.parse(response.body) as ListTokenResponse;
    expect(response.statusCode).toBe(200);
    expect(body.tokens).toBeArrayOfSize(2);
    expect(body.tokens.map((o: Token) => o.machineId)).toIncludeSameMembers(['machine-id-1', 'machine-id-1']);
    expect(body.tokens.map((o: Token) => o.tokenId)).toIncludeSameMembers(['token-id-1', 'token-id-2']);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should list tokens when limit parameter is provided', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-1', 'token-id-3'),
      generateToken('machine-id-1', 'token-id-4'),
    ]);

    let response = await listTokenHandler('machine-id-1', { limit: '3' });
    let body = JSON.parse(response.body) as ListTokenResponse;

    expect(response.statusCode).toBe(200);
    expect(body.tokens).toBeArrayOfSize(3);
    expect(body).not.toHaveProperty('nextToken');

    response = await listTokenHandler('machine-id-1', { limit: '5' });
    body = JSON.parse(response.body) as ListTokenResponse;

    expect(response.statusCode).toBe(200);
    expect(body.tokens).toBeArrayOfSize(4);
    expect(body).not.toHaveProperty('nextToken');
  });

  it('should paginate tokens based on parameters', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-1', 'token-id-3'),
      generateToken('machine-id-1', 'token-id-4'),
    ]);

    let response = await listTokenHandler('machine-id-1', { pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListTokenResponse;
    expect(firstPage.tokens).toBeArrayOfSize(3);

    response = await listTokenHandler('machine-id-1', { pageSize: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListTokenResponse;
    expect(secondPage.tokens).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect([...firstPage.tokens, ...secondPage.tokens].map((o: Token) => o.machineId)).toIncludeSameMembers([
      'machine-id-1',
      'machine-id-1',
      'machine-id-1',
      'machine-id-1',
    ]);
    expect([...firstPage.tokens, ...secondPage.tokens].map((o: Token) => o.tokenId)).toIncludeSameMembers([
      'token-id-1',
      'token-id-2',
      'token-id-3',
      'token-id-4',
    ]);
  });

  it('should paginate token based on parameters when limit is applied', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-1', 'token-id-3'),
      generateToken('machine-id-1', 'token-id-4'),
    ]);

    let response = await listTokenHandler('machine-id-1', { pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListTokenResponse;
    expect(firstPage.tokens).toBeArrayOfSize(2);

    response = await listTokenHandler('machine-id-1', { pageSize: '2', limit: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListTokenResponse;
    expect(secondPage.tokens).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([
      generateToken('machine-id-1', 'token-id-1'),
      generateToken('machine-id-1', 'token-id-2'),
      generateToken('machine-id-1', 'token-id-3'),
      generateToken('machine-id-1', 'token-id-4'),
    ]);

    let response = await listTokenHandler('machine-id-1', { pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body) as ListTokenResponse;
    expect(firstPage.tokens).toBeArrayOfSize(2);

    // Limit in the second request should be ignored
    response = await listTokenHandler('machine-id-1', { pageSize: '2', limit: '9999', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body) as ListTokenResponse;
    expect(secondPage.tokens).toBeArrayOfSize(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should return 400 when given an invalid nextToken', async () => {
    await generateMachine('machine-id-1');

    const response = await listTokenHandler('machine-id-1', { nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    await generateMachine('machine-id-1');

    const response = await listTokenHandler('machine-id-1', { limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    await generateMachine('machine-id-1');

    const response = await listTokenHandler('machine-id-1', { pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 403 if the creator of the machine is not the same as the caller', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([generateToken('machine-id-1', 'token-id-1')]);

    const response = await listTokenHandler('machine-id-1', undefined, 'another-user', 'default');

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("You don't access to the token inside the machine machine-id-1");
  });

  it('should list the token if the caller user is an admin', async () => {
    await generateMachine('machine-id-1');
    await Promise.all([generateToken('machine-id-1', 'token-id-1')]);

    const response = await listTokenHandler('machine-id-1', undefined, 'another-admin', 'admin,default,power-user');
    const firstPage = JSON.parse(response.body) as ListTokenResponse;

    expect(response.statusCode).toBe(200);
    expect(firstPage.tokens).toBeArrayOfSize(1);
  });

  it('should return 404 if the machine does not exist', async () => {
    await Promise.all([generateToken('machine-id-1', 'token-id-1')]);

    const response = await listTokenHandler('machine-id-1');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('No machine found with id machine-id-1');
  });
});
