/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AthenaQueryExecutionState,
  DataIntegrity,
  DataProductAccess,
  DataSetIds,
  StepFunctionExecutionStatus,
} from '@ada/common';
import { CachedQueryStore } from '../../../components/ddb/cached-query';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/infra-common/services/testing';
import { DataProduct, DataSets, PaginatedQueryResult, PostQueryParseRenderDiscoverResponse } from '@ada/api';
import { DataProductPermissions } from '@ada/microservice-common';
import { MAX_REQUESTS, calculateTimeout, handler } from '../get-query-sync-result';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

const queryDiscoverResponse: PostQueryParseRenderDiscoverResponse = {
  tables: [{ identifierParts: ['default', 'test'] }],
};

const getDataProductPolicy: DataProductPermissions = {
  admin: {
    access: DataProductAccess.FULL,
  },
};

const dataSets: DataSets = {
  [DataSetIds.DEFAULT]: {
    columnMetadata: {},
    identifiers: {},
  },
};

const newDataProduct: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets,
};

const updatedDataProduct: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  latestDataUpdateTimestamp: '2021-10-10T00:00:00.000Z',
  dataSets,
};

jest.mock('@ada/api-client');

const mockDescribeExecution = jest.fn();
const mockGetqueryResults = jest.fn();

// @ts-ignore mock the timer to avoid timeouts
calculateTimeout = jest.fn();

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

// Helper method for calling the handler
const getQuerySyncResultHandlder = (executionId: string, queryString?: any): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      queryStringParameters: queryString,
      pathParameters: { executionId },
      requestContext: {
        stage: 'prod',
      },
    }),
    null,
  );

const testCachedStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
CachedQueryStore.getInstance = jest.fn(() => testCachedStore);

describe('get-query-sync-results', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  afterEach(async () => {
    // jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return a redirect result if the query execution has not been completed yet', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.RUNNING,
    });

    const result = await getQuerySyncResultHandlder('an-execution-id');

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockDescribeExecution).toBeCalledTimes(MAX_REQUESTS);
    expect(result.statusCode).toBe(303);
    expect(JSON.parse(result.body)).toHaveProperty('message');
    expect(result.headers!.location).toBe('/prod/query/sync/an-execution-id/result');
  });

  it.each([
    [StepFunctionExecutionStatus.RUNNING, undefined],
    [StepFunctionExecutionStatus.RUNNING, AthenaQueryExecutionState.QUEUED],
    [StepFunctionExecutionStatus.RUNNING, AthenaQueryExecutionState.RUNNING],
    [StepFunctionExecutionStatus.TIMED_OUT, AthenaQueryExecutionState.RUNNING],
  ])(
    'should return a redirect result if the query execution has not been completed yet (step=%s,athena=%s)',
    async (stepFunctionStatus, athenaState) => {
      mockDescribeExecution.mockReturnValueOnce({
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: stepFunctionStatus,
        output: athenaState
          ? JSON.stringify({
              athenaStatus: {
                QueryExecution: {
                  Status: {
                    State: athenaState,
                  },
                },
              },
            })
          : undefined,
      });

      const result = await getQuerySyncResultHandlder('an-execution-id');

      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(mockDescribeExecution).toBeCalledTimes(MAX_REQUESTS);
      expect(result.statusCode).toBe(303);
      expect(JSON.parse(result.body)).toHaveProperty('message');
      expect(result.headers!.location).toBe('/prod/query/sync/an-execution-id/result');
    },
  );

  it.each([
    [StepFunctionExecutionStatus.FAILED, AthenaQueryExecutionState.FAILED],
    [StepFunctionExecutionStatus.ABORTED, AthenaQueryExecutionState.CANCELLED],
    [StepFunctionExecutionStatus.TIMED_OUT, AthenaQueryExecutionState.CANCELLED],
    [StepFunctionExecutionStatus.TIMED_OUT, AthenaQueryExecutionState.FAILED],
    [StepFunctionExecutionStatus.SUCCEEDED, AthenaQueryExecutionState.FAILED],
  ])(
    'should return an error if the query has been executed but not succeeded (step=%s,athena=%s)',
    async (stepFunctionStatus, athenaState) => {
      const baseDescribeExecutionResult = {
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: StepFunctionExecutionStatus.RUNNING,
      };
      mockDescribeExecution.mockReturnValueOnce(baseDescribeExecutionResult);
      mockDescribeExecution.mockReturnValueOnce({
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: stepFunctionStatus,
        output: JSON.stringify({
          athenaStatus: {
            QueryExecution: {
              Status: {
                StateChangeReason: 'any underlying error',
                State: athenaState,
              },
            },
          },
        }),
      });

      const result = await getQuerySyncResultHandlder('an-execution-id');
      const body = JSON.parse(result.body);

      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(mockDescribeExecution).toBeCalledTimes(2);
      expect(result.statusCode).toBe(400);
      expect(body).toStrictEqual({
        message: 'Failed to execute query',
        details: 'any underlying error',
        name: 'Error',
        errorId: expect.stringMatching(/\w{10}/),
      });
    },
  );

  it('should return the query results if the execution eventually succeeded', async () => {
    const baseDescribeExecutionResult = {
      input: JSON.stringify({
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.RUNNING,
    };
    mockDescribeExecution.mockReturnValueOnce(baseDescribeExecutionResult);
    mockDescribeExecution.mockReturnValueOnce({
      ...baseDescribeExecutionResult,
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
    mockGetqueryResults.mockReturnValueOnce({ NextToken: 'skip-header-row' });
    mockGetqueryResults.mockReturnValueOnce({
      ResultSet: {
        Rows: [
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
    });

    const result = await getQuerySyncResultHandlder('an-execution-id');
    const body = JSON.parse(result.body) as PaginatedQueryResult;

    expect(mockDescribeExecution).toBeCalledTimes(2);
    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(2);
    // first time called to strip the header
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(1, {
      QueryExecutionId: 'athena-query-execution-id',
      MaxResults: 1,
    });
    // second time called to get all data with no additional params
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(2, {
      QueryExecutionId: 'athena-query-execution-id',
      MaxResults: 1000, // default value
      NextToken: 'skip-header-row',
    });
    expect(result.statusCode).toBe(200);
    expect(body.dataIntegrity).toBeUndefined();
    expect(body.nextToken).toBeUndefined();
    expect(body.error).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade',
        'player.characteristics.playercountry': 'USA',
        'player.characteristics.power': 301,
        'player.username': 'user-1',
      },
    ]);
  });

  it.each([
    // cacheUpdatedDate, expectedDataIntegrity
    [undefined, DataIntegrity.CURRENT],
    ['2021-01-01T00:00:00.000Z', DataIntegrity.STALE],
    ['2021-11-01T00:00:00.000Z', DataIntegrity.CURRENT],
  ])(
    'should return the query results with data integrity field if requested (cacheUpdatedDate=%s, expectedDataIntegrity=%s)',
    async (cacheUpdatedDate, expectedDataIntegrity) => {
      const baseDescribeExecutionResult = {
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: StepFunctionExecutionStatus.RUNNING,
      };
      API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
      API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue(getDataProductPolicy);
      // dp update date is '2021-10-10T00:00:00.000Z'
      API.getDataProductDomainDataProduct.mockResolvedValue(cacheUpdatedDate ? updatedDataProduct : newDataProduct);
      mockDescribeExecution.mockReturnValueOnce(baseDescribeExecutionResult);
      mockDescribeExecution.mockReturnValueOnce({
        ...baseDescribeExecutionResult,
        status: StepFunctionExecutionStatus.SUCCEEDED,
        output: JSON.stringify({
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          originalQuery: 'select * from dm.dp',
          updatedTimestamp: cacheUpdatedDate,
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
      mockGetqueryResults.mockReturnValueOnce({ NextToken: 'skip-header-row' });
      mockGetqueryResults.mockReturnValueOnce({
        ResultSet: {
          Rows: [
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
      });

      const result = await getQuerySyncResultHandlder('an-execution-id', { retrieveDataIntegrity: 'true' });
      const body = JSON.parse(result.body) as PaginatedQueryResult;

      expect(mockDescribeExecution).toBeCalledTimes(2);
      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(mockGetqueryResults).toHaveBeenCalledTimes(2);
      // first time called to strip the header
      expect(mockGetqueryResults).toHaveBeenNthCalledWith(1, {
        QueryExecutionId: 'athena-query-execution-id',
        MaxResults: 1,
      });
      // second time called to get all data with no additional params
      expect(mockGetqueryResults).toHaveBeenNthCalledWith(2, {
        QueryExecutionId: 'athena-query-execution-id',
        MaxResults: 1000, // default value
        NextToken: 'skip-header-row',
      });
      expect(result.statusCode).toBe(200);
      expect(body.nextToken).toBeUndefined();
      expect(body.error).toBeUndefined();
      expect(body.dataIntegrity).toBe(expectedDataIntegrity);
      expect(body.data).toStrictEqual([
        {
          'player.characteristics.class': 'Dawnblade',
          'player.characteristics.playercountry': 'USA',
          'player.characteristics.power': 301,
          'player.username': 'user-1',
        },
      ]);
    },
  );
});
