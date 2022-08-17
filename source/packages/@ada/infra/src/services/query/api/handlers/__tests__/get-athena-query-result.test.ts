/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AthenaQueryExecutionState,
  CallingUser,
  DataIntegrity,
  DataProductAccess,
  DataSetIds,
  StepFunctionExecutionStatus,
} from '@ada/common';
import { CachedQueryStore } from '../../../components/ddb/cached-query';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/infra-common/services/testing';
import { DataProduct, DataSets, PaginatedQueryResult, PostQueryParseRenderDiscoverResponse } from '@ada/api';
import { DataProductPermissions } from '@ada/microservice-common';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get-athena-query-result';

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
  queryString?: { [key: string]: string },
  callingUser: CallingUser = DEFAULT_CALLER,
): Promise<APIGatewayProxyResult> =>
  handler(
    buildApiRequest(callingUser, {
      pathParameters: { executionId },
      queryStringParameters: queryString,
    }) as any,
    null,
  );

describe('get-athena-query-result', () => {
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

  it('should return the query results without additional pages', async () => {
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
    const body = JSON.parse(result.body) as PaginatedQueryResult;

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
    expect(body.dataIntegrity).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade',
        'player.characteristics.playercountry': 'USA',
        'player.characteristics.power': 301,
        'player.username': 'user-1',
      },
    ]);

    expect(body.columns).toEqual([
      {
        name: 'player.username',
        label: 'player.username',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
      {
        name: 'player.characteristics.class',
        label: 'player.characteristics.class',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
      {
        name: 'player.characteristics.power',
        label: 'player.characteristics.power',
        type: 'integer',
        precision: 10,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: false,
      },
      {
        name: 'player.characteristics.playercountry',
        label: 'player.characteristics.playercountry',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
    ]);
  });

  it('should return the query results without the undefined columns', async () => {
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
              {},
              {},
            ],
          },
        ],
        ResultSetMetadata: {
          ColumnInfo: athenaMockColumnsSchema,
        },
      },
    });
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
    const body = JSON.parse(result.body) as PaginatedQueryResult;

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
    expect(body.dataIntegrity).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade',
        'player.username': 'user-1',
      },
    ]);

    expect(body.columns).toEqual([
      {
        name: 'player.username',
        label: 'player.username',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
      {
        name: 'player.characteristics.class',
        label: 'player.characteristics.class',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
      {
        name: 'player.characteristics.power',
        label: 'player.characteristics.power',
        type: 'integer',
        precision: 10,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: false,
      },
      {
        name: 'player.characteristics.playercountry',
        label: 'player.characteristics.playercountry',
        type: 'varchar',
        precision: 2147483647,
        scale: 0,
        nullable: 'UNKNOWN',
        caseSensitive: true,
      },
    ]);
  });

  it.each([
    // cacheUpdatedDate, expectedDataIntegrity
    [undefined, DataIntegrity.CURRENT],
    ['2021-01-01T00:00:00.000Z', DataIntegrity.STALE],
    ['2021-11-01T00:00:00.000Z', DataIntegrity.CURRENT],
  ])(
    'should return the data integrity field if has been requested (cacheUpdatedDate=%s, expectedDataIntegrity=%s)',
    async (cacheUpdatedDate, expectedDataIntegrity) => {
      API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
      API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue(getDataProductPolicy);
      // dp update date is '2021-10-10T00:00:00.000Z'
      API.getDataProductDomainDataProduct.mockResolvedValue(cacheUpdatedDate ? updatedDataProduct : newDataProduct);
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

      const result = await getQueryResultsHandler('an-execution-id', { retrieveDataIntegrity: 'true' });
      const body = JSON.parse(result.body) as PaginatedQueryResult;

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

  it('should not return the query results without additional pages if executed by another user', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'another-user',
          groups: ['analyst'],
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

    const result = await getQueryResultsHandler(
      'an-execution-id',
      {},
      {
        ...DEFAULT_CALLER,
        userId: 'yet-another-user',
        groups: ['analyst'],
      },
    );
    expect(result.statusCode).toBe(403);
  });

  it('should return the query results WITH additional pages', async () => {
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
      NextToken: 'next-page-after-one',
    });
    mockGetqueryResults.mockReturnValueOnce({
      ResultSet: {
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'user-2',
              },
              {
                VarCharValue: 'Dawnblade-2',
              },
              {
                VarCharValue: '302',
              },
              {
                VarCharValue: 'USA-2',
              },
            ],
          },
        ],
        ResultSetMetadata: {
          ColumnInfo: athenaMockColumnsSchema,
        },
      },
      NextToken: 'next-page-after-two',
    });
    mockGetqueryResults.mockReturnValueOnce({
      ResultSet: {
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'user-3',
              },
              {
                VarCharValue: 'Dawnblade-3',
              },
              {
                VarCharValue: '303',
              },
              {
                VarCharValue: 'USA-3',
              },
            ],
          },
        ],
        ResultSetMetadata: {
          ColumnInfo: athenaMockColumnsSchema,
        },
      },
    });

    const queryCaller = {
      ...DEFAULT_CALLER,
      userId: 'query-caller',
      groups: ['analyst'],
    };

    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: queryCaller,
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

    let result = await getQueryResultsHandler('an-execution-id', { limit: '3', pageSize: '1' }, queryCaller);
    console.log('res body is', result.body);
    let body = JSON.parse(result.body) as PaginatedQueryResult;

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
      MaxResults: 1,
      NextToken: 'skip-header-row',
    });
    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeDefined();
    expect(body.error).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade',
        'player.characteristics.playercountry': 'USA',
        'player.characteristics.power': 301,
        'player.username': 'user-1',
      },
    ]);

    // fetch page 2
    result = await getQueryResultsHandler(
      'an-execution-id',
      {
        nextToken: body.nextToken!,
        pageSize: '1',
        limit: '3',
      },
      queryCaller,
    );
    body = JSON.parse(result.body) as PaginatedQueryResult;
    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(3);
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(3, {
      MaxResults: 1,
      NextToken: 'next-page-after-one',
      QueryExecutionId: 'athena-query-execution-id',
    });
    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeDefined();
    expect(body.error).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade-2',
        'player.characteristics.playercountry': 'USA-2',
        'player.characteristics.power': 302,
        'player.username': 'user-2',
      },
    ]);

    // fetch page 3 (last page)
    result = await getQueryResultsHandler(
      'an-execution-id',
      {
        nextToken: body.nextToken!,
        pageSize: '1',
        limit: '3',
      },
      queryCaller,
    );
    body = JSON.parse(result.body) as PaginatedQueryResult;
    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockGetqueryResults).toHaveBeenCalledTimes(4);
    expect(mockGetqueryResults).toHaveBeenNthCalledWith(4, {
      MaxResults: 1,
      NextToken: 'next-page-after-two',
      QueryExecutionId: 'athena-query-execution-id',
    });
    expect(result.statusCode).toBe(200);
    expect(body.nextToken).toBeUndefined();
    expect(body.error).toBeUndefined();
    expect(body.data).toStrictEqual([
      {
        'player.characteristics.class': 'Dawnblade-3',
        'player.characteristics.playercountry': 'USA-3',
        'player.characteristics.power': 303,
        'player.username': 'user-3',
      },
    ]);
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
                StateChangeReason: 'any underlying error',
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
      expect(body.details).toBe('any underlying error');
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
        Error: 'oh no',
        Cause: JSON.stringify({ errorMessage: 'any underlying error' }),
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
    expect(body.details).toBe('oh no: any underlying error');
  });
});
