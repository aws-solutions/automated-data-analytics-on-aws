/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { QueryHistoryStore } from '../../../components/ddb/query-history';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/infra-common/services/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../start-query-execution-sync';

// Mock the domain store to point to our local dynamodb
const testQueryHistoryStore = new (QueryHistoryStore as any)(getLocalDynamoDocumentClient());
QueryHistoryStore.getInstance = jest.fn(() => testQueryHistoryStore);

const mockStartExecution = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    startExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartExecution(...args))),
    }),
  })),
}));

// Helper method for calling the handler
const getStartQuerySyncHandlder = (query: string): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      queryStringParameters: {
        query,
      },
      requestContext: {
        stage: 'prod',
      },
    }),
    null,
  );

describe('start-query-execution-sync', () => {
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

  it.each([
    'SELECT * FROM foo',
    encodeURIComponent('SELECT * FROM "AwsDataCatalog"."ada_database"."domain6-product6-transform-0-0"'),
  ])('should start the step function to execute the provided query (encoded or not)', async (query) => {
    mockStartExecution.mockReturnValue({
      executionArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:HelloWorld:abcd-1234-dsdsd',
    });

    const result = await getStartQuerySyncHandlder(query);

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN,
      input: JSON.stringify({
        query: decodeURIComponent(query),
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          username: 'test-user@usr.example.com',
          groups: ['admin', 'analyst'],
        },
      }),
    });
    expect(result.statusCode).toBe(303);
    expect(JSON.parse(result.body)).toHaveProperty('message');
    expect(result.headers!.location).toBe('/prod/query/sync/abcd-1234-dsdsd/result');

    const userHistory = await testQueryHistoryStore.getUserQueryHistory('test-user', {});
    expect(userHistory.queries).toHaveLength(1);
    expect(userHistory.queries[0]).toStrictEqual({
      createdBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      executionId: 'abcd-1234-dsdsd',
      query: decodeURIComponent(query),
      updatedBy: 'test-user',
    });
  });
});
