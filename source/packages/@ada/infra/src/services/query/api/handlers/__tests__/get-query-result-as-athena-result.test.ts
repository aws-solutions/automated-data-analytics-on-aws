/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AthenaQueryExecutionState, StepFunctionExecutionStatus } from '@ada/common';
import { CachedQueryStore } from '../../../components/ddb/cached-query';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/infra-common/services/testing';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-query-result-as-athena-result';

const mockDescribeExecution = jest.fn();
const mockGetqueryResults = jest.fn();

const athenaMockColumnsSchema = [
  {
    CatalogName: 'hive',
    SchemaName: '',
    TableName: '',
    Name: 'player.username',
    Label: 'player.username',
    Type: 'varchar',
    Precision: 2147483647,
    Scale: 0,
    Nullable: 'UNKNOWN',
    CaseSensitive: true,
  },
  {
    CatalogName: 'hive',
    SchemaName: '',
    TableName: '',
    Name: 'player.characteristics.class',
    Label: 'player.characteristics.class',
    Type: 'varchar',
    Precision: 2147483647,
    Scale: 0,
    Nullable: 'UNKNOWN',
    CaseSensitive: true,
  },
  {
    CatalogName: 'hive',
    SchemaName: '',
    TableName: '',
    Name: 'player.characteristics.power',
    Label: 'player.characteristics.power',
    Type: 'integer',
    Precision: 10,
    Scale: 0,
    Nullable: 'UNKNOWN',
    CaseSensitive: false,
  },
  {
    CatalogName: 'hive',
    SchemaName: '',
    TableName: '',
    Name: 'player.characteristics.playercountry',
    Label: 'player.characteristics.playercountry',
    Type: 'varchar',
    Precision: 2147483647,
    Scale: 0,
    Nullable: 'UNKNOWN',
    CaseSensitive: true,
  },
];

const athenaMockResults1 = {
  ResultSet: {
    Rows: [
      {
        Data: [
          {
            VarCharValue: 'player.username',
          },
          {
            VarCharValue: 'player.characteristics.class',
          },
          {
            VarCharValue: 'player.characteristics.power',
          },
          {
            VarCharValue: 'player.characteristics.playercountry',
          },
        ],
      },
      {
        Data: [
          {
            VarCharValue: 'user-1',
          },
          {
            VarCharValue: 'Dawnblade',
          },
          {
            VarCharValue: '301',
          },
          {
            VarCharValue: 'USA',
          },
        ],
      },
    ],
    ResultSetMetadata: {
      ColumnInfo: athenaMockColumnsSchema,
    },
  },
};

const athenaMockResults2 = {
  ResultSet: {
    Rows: [
      {
        Data: [
          {}, // athena returns {} for empty datum
          {
            VarCharValue: 'Dawnblade2',
          },
          {
            VarCharValue: '302',
          },
          {
            VarCharValue: 'USA2',
          },
        ],
      },
    ],
    ResultSetMetadata: {
      ColumnInfo: athenaMockColumnsSchema,
    },
  },
};

jest.mock('@ada/api-client');

const testCachedStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
CachedQueryStore.getInstance = jest.fn(() => testCachedStore);

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    describeExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeExecution(...args))),
    }),
  })),
  AwsAthenaInstance: jest.fn().mockImplementation(() => ({
    getQueryResults: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetqueryResults(...args))),
    }),
  })),
}));

const getQueryResultsHandler = (
  executionId: string,
  queryString?: { [key: string]: string | undefined },
): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      pathParameters: { executionId },
      queryStringParameters: queryString,
    }),
    null,
  );

describe('get-query-result-as-athena', () => {
  let testCachedStore: CachedQueryStore;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    // Mock the dataProduct store to point to our local dynamodb
    testCachedStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
    CachedQueryStore.getInstance = jest.fn(() => testCachedStore);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return query results as athena results', async () => {
    mockGetqueryResults.mockReturnValueOnce(athenaMockResults1);
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        queryExecutionId: 'athena-query-execution-id',
        athenaStatus: {
          QueryExecution: {
            QueryExecutionId: 'athena-query-execution-id',
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getQueryResultsHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(1);

    // second time called to get all data with no additional params
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(1, {
      QueryExecutionId: 'athena-query-execution-id',
    });
    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeUndefined();
    expect(body.updateCount).toBeUndefined();
    expect(body.resultSet.Rows.length).toBe(2);
    expect(body.resultSet.Rows).toStrictEqual(athenaMockResults1.ResultSet.Rows);
    expect(body.resultSet.ResultSetMetadata.ColumnInfo).toEqual(
      athenaMockResults1.ResultSet.ResultSetMetadata.ColumnInfo,
    );
  });

  it('should return the query results WITH additional pages', async () => {
    mockGetqueryResults.mockReturnValueOnce({
      ...athenaMockResults1,
      NextToken: 'next-page-after-one',
    });
    mockGetqueryResults.mockReturnValueOnce({
      ...athenaMockResults2,
      NextToken: 'next-page-after-two',
    });

    let result = await getQueryResultsHandler('an-execution-id', { maxResults: '1' });
    let body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(1);

    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeDefined();
    expect(body.resultSet.Rows).toStrictEqual(athenaMockResults1.ResultSet.Rows);
    expect(body.resultSet.ResultSetMetadata.ColumnInfo).toEqual(
      athenaMockResults1.ResultSet.ResultSetMetadata.ColumnInfo,
    );

    // fetch page 2
    result = await getQueryResultsHandler('an-execution-id', {
      maxResults: '1',
      nextToken: body.nextToken,
    });
    body = JSON.parse(result.body);
    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(2);
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(2, {
      MaxResults: 1,
      NextToken: 'next-page-after-one',
      QueryExecutionId: 'athena-query-execution-id',
    });
    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeDefined();
    expect(body.resultSet.Rows).toStrictEqual(athenaMockResults2.ResultSet.Rows);
    expect(body.resultSet.ResultSetMetadata.ColumnInfo).toEqual(
      athenaMockResults2.ResultSet.ResultSetMetadata.ColumnInfo,
    );
  });

  it('should not return the query results if the user has no access', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'another-user',
          groups: ['developer'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        queryExecutionId: 'athena-query-execution-id',
        athenaStatus: {
          QueryExecution: {
            QueryExecutionId: 'athena-query-execution-id',
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getQueryResultsHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(403);
    expect(body.message).toBe('The user test-user does not have the rights to perform this action');
  });

  it.each([StepFunctionExecutionStatus.SUCCEEDED, StepFunctionExecutionStatus.FAILED])(
    'should return an error if step function state is %s and athena query did not succeed',
    async (stepState) => {
      mockDescribeExecution.mockReturnValue({
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: stepState,
        output: JSON.stringify({
          queryExecutionId: 'athena-query-execution-id',
          athenaStatus: {
            QueryExecution: {
              QueryExecutionId: 'athena-query-execution-id',
              Status: {
                State: AthenaQueryExecutionState.FAILED,
                StateChangeReason: 'something went wrong',
              },
            },
          },
        }),
      });

      const result = await getQueryResultsHandler('an-execution-id');
      const body = JSON.parse(result.body);

      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(mockGetqueryResults).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(400);
      expect(body.message).toBe('Failed to execute query');
      expect(body.details).toBe('something went wrong');
    },
  );

  it('should return an error if step function finished with an error', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        Error: 'oops',
        Cause: JSON.stringify({ errorMessage: 'something went wrong' }),
      }),
    });

    const result = await getQueryResultsHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Failed to execute query');
    expect(body.details).toBe('oops: something went wrong');
  });
});
