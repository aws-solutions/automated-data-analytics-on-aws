/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyEventHeaders, APIGatewayProxyResult } from 'aws-lambda';
import { QueryExecutionStatus } from '@ada/common';
import { apiGatewayEvent, recreateAllTables } from '@ada/infra-common/services/testing';
import { athenaCmds, extractAPIKey, getFullyQualifiedTableName, handler } from '../athena-proxy';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Connectors } from '@ada/connectors';

const MOCK_DOMAIN = {
  domainId: 'my-domain-id',
  name: 'Marketing',
  description: 'The marketing domain',
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};

const MOCK_DATA_PRODUCT = {
  dataProductId: 'my-customer-dp-id',
  domainId: 'my-domain-id',
  name: 'Customers',
  description: 'Full record of all customers',
  owningGroups: ['group1', 'group2'],
  sourceType: Connectors.Id.S3,
  sourceDetails: {
    bucket: 'examplebucket',
    key: 'mydata',
  },
  createdTimestamp: '2021-12-07T22:25:33.234',
  tags: [{ key: 'Key', value: 'Value' }],
  dataSets: {
    ada_default_dataset: {
      columnMetadata: {
        firstName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer first name',
        },
        lastName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer last name',
        },
        email: {
          dataType: 'string',
          description: 'The customer email',
        },
      },
      identifier: {
        catalog: 'my-domain-id',
        database: 'processed_db',
      },
    },
    customerDataSet: {
      identifiers: {
        catalog: 'my-domain-id',
        database: 'processed_db',
        table: 'customers_data_product',
      },
      columnMetadata: {
        firstName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer first name',
        },
        lastName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer last name',
        },
        email: {
          dataType: 'string',
          description: 'The customer email',
        },
      },
    },
    anotherCustomerDataSet: {
      identifiers: {
        catalog: 'my-domain-id',
        database: 'processed_db',
        table: 'customers_data_product',
      },
      columnMetadata: {
        firstName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer first name',
        },
        lastName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer last name',
        },
        email: {
          dataType: 'string',
          description: 'The customer email',
        },
      },
    },
  },
};

const enum AthenaQueryExecutionState {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

const getAccessTokenMock = jest.fn();

jest.mock('@ada/api-client');
jest.mock('node-fetch');
jest.mock('../../../../../../common/services/utils/cognito', () => ({
  getAccessToken: jest.fn().mockImplementation(() => getAccessTokenMock()),
}));

const getAthenaProxyHandler = (headers: APIGatewayProxyEventHeaders, body?: string): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      headers: headers,
      body: body,
    }),
  );

describe('athena-proxy', () => {
  let requestHeaders: { [key: string]: string };
  const cfHeaders = {
    'user-agent': 'Amazon CloudFront',
    via: '1.1 anything.cloudfront.net (CloudFront)',
    'x-amz-cf-id': 'base64-encoded-cf-id',
  };
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    requestHeaders = {
      Authorization:
        'AWS4-HMAC-SHA256 Credential=api-key mockkey/ap-southeast-2/athena/aws4_request, SignedHeaders=amz-sdk-invocation-id;amz-sdk-request',
      ...cfHeaders,
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('should throw exception when x-amz-target is missing', async () => {
    getAccessTokenMock.mockReturnValue('any');
    const requestBody = Buffer.from('{"":""}').toString('base64');
    const result = getAthenaProxyHandler(requestHeaders, requestBody);
    await expect(result).rejects.toThrowError('Missing x-amz-target');
  });

  it.each([undefined, null, ''])('should throw exception when the access token is missing', async (accessToken) => {
    getAccessTokenMock.mockReturnValue(accessToken);

    const requestBody = Buffer.from('{"":""}').toString('base64');
    const result = getAthenaProxyHandler(requestHeaders, requestBody);
    await expect(result).rejects.toThrowError('Error retrieving the access token');
  });

  it('should throw exception when authorization header is missing', async () => {
    const requestHeaders = {
      Authorization: '',
      ...cfHeaders,
    };
    const result = getAthenaProxyHandler(requestHeaders);
    await expect(result).rejects.toThrowError('Unauthorized');
  });

  it.each([
    [undefined, '1.1 randomid.cloudfront.net (CloudFront)', 'random-id-base64'],
    [null, '1.1 randomid.cloudfront.net (CloudFront)', 'random-id-base64'],
    ['', '1.1 randomid.cloudfront.net (CloudFront)', 'random-id-base64'],
    ['Amazon CloudFront', undefined, 'random-id-base64'],
    ['Amazon CloudFront', null, 'random-id-base64'],
    ['Amazon CloudFront', '', 'random-id-base64'],
    ['Amazon CloudFront', '1.1 randomid.cloudfront.net (CloudFront)', undefined],
    ['Amazon CloudFront', '1.1 randomid.cloudfront.net (CloudFront)', null],
    ['Amazon CloudFront', '1.1 randomid.cloudfront.net (CloudFront)', ''],
  ])('should throw exception if any of the cf headers is missing or invalid', async (userAgent, via, cfId) => {
    const result = getAthenaProxyHandler({
      ...requestHeaders,
      'user-agent': userAgent,
      via,
      'x-amz-cf-id': cfId,
    });

    await expect(result).rejects.toThrowError('Unexpected request');
  });

  it('should extract correct api key from the header', async () => {
    const apiKey = extractAPIKey(
      'AWS4-HMAC-SHA256 Credential=api-key {{apiKey}}/ap-southeast-2/athena/aws4_request, SignedHeaders=amz-sdk-invocation-id;amz-sdk-request',
    );
    expect(apiKey).toEqual('{{apiKey}}');
  });

  it('should list AwsDataCatalog and domains as catalog', async () => {
    getAccessTokenMock.mockReturnValue('any');

    const requestHeaders = {
      Authorization:
        'AWS4-HMAC-SHA256 Credential=api-key mockkey/ap-southeast-2/athena/aws4_request, SignedHeaders=amz-sdk-invocation-id;amz-sdk-request',
      'x-amz-target': athenaCmds.listDataCatalogs,
      ...cfHeaders,
    };
    const requestBody = '';
    API.listDataProductDomains.mockResolvedValue({ domains: [MOCK_DOMAIN] });
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody).toEqual({
      DataCatalogsSummary: [
        {
          CatalogName: 'AwsDataCatalog',
          Description: 'AwsDataCatalog',
          Type: 'HIVE',
        },
        {
          CatalogName: MOCK_DOMAIN.domainId,
          Description: MOCK_DOMAIN.name,
          Type: 'HIVE',
        },
      ],
    });
  });

  it('should throw exception if catalog is missing when list database', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.listDatabases;
    const requestBody = Buffer.from('{"CatalogName":""}').toString('base64');
    API.listDataProductDomainDataProducts.mockResolvedValue({ dataProducts: [MOCK_DATA_PRODUCT as any] });
    const result = getAthenaProxyHandler(requestHeaders, requestBody);
    await expect(result).rejects.toThrowError();
  });

  it('should list data product as databases', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.listDatabases;
    const requestBody = Buffer.from('{"CatalogName":"my-domain-id"}').toString('base64');
    API.listDataProductDomainDataProducts.mockResolvedValue({ dataProducts: [MOCK_DATA_PRODUCT as any] });
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.DatabaseList).toBeDefined();
    expect(responseBody.DatabaseList).toStrictEqual([
      {
        Description: MOCK_DATA_PRODUCT.name,
        Name: MOCK_DATA_PRODUCT.dataProductId,
        Parameters: {
          Id: MOCK_DATA_PRODUCT.dataProductId,
        },
      },
    ]);
  });

  it('should list datasets as data tables without default ada dataset', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.listTableMetadata;
    const requestBody = Buffer.from('{"CatalogName":"my-domain-id", "DatabaseName":"my-customer-dp-id"}').toString(
      'base64',
    );
    API.getDataProductDomainDataProduct.mockResolvedValue(MOCK_DATA_PRODUCT as any);
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.TableMetadataList).toHaveLength(2);
    expect(responseBody.TableMetadataList).toBeDefined();
    expect(responseBody.TableMetadataList).toStrictEqual([
      {
        CreateTime: new Date(MOCK_DATA_PRODUCT.createdTimestamp).toISOString(),
        Name: 'customerDataSet',
        TableType: 'EXTERNAL_TABLE',
        Parameters: {
          datasetName: 'customerDataSet',
        },
        Columns: [
          {
            Comment: 'firstName',
            Name: 'firstName',
            Type: 'string',
          },
          {
            Comment: 'lastName',
            Name: 'lastName',
            Type: 'string',
          },
          {
            Comment: 'email',
            Name: 'email',
            Type: 'string',
          },
        ],
      },
      {
        CreateTime: new Date(MOCK_DATA_PRODUCT.createdTimestamp).toISOString(),
        Name: 'anotherCustomerDataSet',
        TableType: 'EXTERNAL_TABLE',
        Parameters: {
          datasetName: 'anotherCustomerDataSet',
        },
        Columns: [
          {
            Comment: 'firstName',
            Name: 'firstName',
            Type: 'string',
          },
          {
            Comment: 'lastName',
            Name: 'lastName',
            Type: 'string',
          },
          {
            Comment: 'email',
            Name: 'email',
            Type: 'string',
          },
        ],
      },
    ]);
  });

  it('should get table schema as data product schema', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.getTableMetadata;
    const requestBody = Buffer.from(
      '{"CatalogName":"aws","DatabaseName":"my-customer-dp-id", "TableName":"customerDataSet"}',
    ).toString('base64');
    API.getDataProductDomainDataProduct.mockResolvedValue(MOCK_DATA_PRODUCT as any);
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.TableMetadata).toBeDefined();
    expect(responseBody.TableMetadata).toEqual({
      CreateTime: new Date(MOCK_DATA_PRODUCT.createdTimestamp).toISOString(),
      Name: 'customerDataSet',
      TableType: 'EXTERNAL_TABLE',
      Columns: [
        {
          Comment: 'firstName',
          Name: 'firstName',
          Type: 'string',
        },
        {
          Comment: 'lastName',
          Name: 'lastName',
          Type: 'string',
        },
        {
          Comment: 'email',
          Name: 'email',
          Type: 'string',
        },
      ],
    });
  });

  it('should throw exception if catalog is missing from queryexecutioncontext while table name is not fully qualified', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.startQueryExecution;
    const requestBody = Buffer.from(
      '{"QueryString":"SELECT \\"posts_val_media\\".\\"id\\" AS \\"id\\",\\n  \\"posts_val_media\\".\\"index\\" AS \\"index\\",\\n  \\"posts_val_media\\".\\"posts.val.media.val.content\\" AS \\"posts_val_media_va\\",\\n  \\"posts_val_media\\".\\"posts.val.media.val.type\\" AS \\"posts_val_media_v1\\"\\nFROM \\"social\\".\\"posts_val_media\\" \\"posts_val_media\\"\\nLIMIT 10000","ClientRequestToken":"fa15b026-8433-425e-adcd-0c509bee5933","QueryExecutionContext":{"Database":"default"},"ResultConfiguration":{"OutputLocation":"s3://"},"WorkGroup":"primary"}',
    ).toString('base64');
    API.postQuery.mockResolvedValue({ executionId: 'mock-execution-id' });
    const result = getAthenaProxyHandler(requestHeaders, requestBody);
    await expect(result).rejects.toThrowError();
  });

  it('should start a query execution', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.startQueryExecution;
    const requestBody = Buffer.from(
      '{"QueryString":"SELECT \\"posts_val_media\\".\\"id\\" AS \\"id\\",\\n  \\"posts_val_media\\".\\"index\\" AS \\"index\\",\\n  \\"posts_val_media\\".\\"posts.val.media.val.content\\" AS \\"posts_val_media_va\\",\\n  \\"posts_val_media\\".\\"posts.val.media.val.type\\" AS \\"posts_val_media_v1\\"\\nFROM \\"social\\".\\"posts_val_media\\" \\"posts_val_media\\"\\nLIMIT 10000","ClientRequestToken":"fa15b026-8433-425e-adcd-0c509bee5933","QueryExecutionContext":{"Database":"default","Catalog":"aws"},"ResultConfiguration":{"OutputLocation":"s3://"},"WorkGroup":"primary"}',
    ).toString('base64');
    API.postQuery.mockResolvedValue({ executionId: 'mock-execution-id' });
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.QueryExecutionId).toBeDefined();
    expect(responseBody.QueryExecutionId).toEqual('mock-execution-id');
  });

  it('should rewrite simple query using fully qualified table name', async () => {
    getAccessTokenMock.mockReturnValue('any');
    const query = `SELECT "friends"."friends.val.fgender" AS "friends_val_fgende", \n
    "friends"."friends.val.fid" AS "friends_val_fid", \n
    "friends"."friends.val.fname" AS "friends_val_fname", \n
    "friends"."id" AS "id", "friends"."index" AS "index" \n
    FROM "social"."friends" "friends" LIMIT 10000`;
    const domainName = 'aws';
    expect(getFullyQualifiedTableName(query, domainName))
      .toStrictEqual(`SELECT "friends"."friends.val.fgender" AS "friends_val_fgende", \n
    "friends"."friends.val.fid" AS "friends_val_fid", \n
    "friends"."friends.val.fname" AS "friends_val_fname", \n
    "friends"."id" AS "id", "friends"."index" AS "index" \n
    FROM "aws"."social"."friends" "friends" LIMIT 10000`);
  });

  it('should not rewrite join query using fully qualified table name', async () => {
    getAccessTokenMock.mockReturnValue('any');
    const query = `SELECT "friends"."friends.val.fgender" AS "friends_val_fgende", \n
    "friends"."friends.val.fid" AS "friends_val_fid", \n
    "friends"."friends.val.fname" AS "friends_val_fname", \n
    "friends"."id" AS "id", "friends"."index" AS "index" \n
    FROM "social"."friends" "friends" \n
    JOIN "social"."posts" "posts" on "posts"."id" = "friends"."id"`;
    const domainName = 'aws';
    expect(getFullyQualifiedTableName(query, domainName))
      .toStrictEqual(`SELECT "friends"."friends.val.fgender" AS "friends_val_fgende", \n
    "friends"."friends.val.fid" AS "friends_val_fid", \n
    "friends"."friends.val.fname" AS "friends_val_fname", \n
    "friends"."id" AS "id", "friends"."index" AS "index" \n
    FROM "aws"."social"."friends" "friends" \n
    JOIN "social"."posts" "posts" on "posts"."id" = "friends"."id"`);
  });

  it('should not rewrite simple query when fully qualified name is used', async () => {
    getAccessTokenMock.mockReturnValue('any');
    const query = `SELECT * FROM (SELECT * \n
      FROM ( \n
        select * from aws.social.friends \n
      ) "TableauSQL" \n
      LIMIT 0) T LIMIT 0`;
    const domainName = 'aws';
    expect(getFullyQualifiedTableName(query, domainName)).toStrictEqual(`SELECT * FROM (SELECT * \n
      FROM ( \n
        select * from aws.social.friends \n
      ) "TableauSQL" \n
      LIMIT 0) T LIMIT 0`);
  });

  it('should stop a query execution', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.stopQueryExecution;
    const requestBody = Buffer.from('{"QueryExecutionId": "mock-execution-id"}').toString('base64');
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.QueryExecutionId).toBeDefined();
    expect(responseBody.QueryExecutionId).toEqual('mock-execution-id');
  });

  it('should get a work group', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.getWorkGroup;
    const requestBody = Buffer.from('{}').toString('base64');
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.WorkGroup).toBeDefined();
  });

  it('should get query exeuction status', async () => {
    getAccessTokenMock.mockReturnValue('any');
    requestHeaders['x-amz-target'] = athenaCmds.getQueryExecution;
    const requestBody = Buffer.from('{"QueryExecutionId": "mock-execution-id"}').toString('base64');
    API.getQueryStatus.mockResolvedValue({ status: QueryExecutionStatus.SUCCEEDED });
    const result = await getAthenaProxyHandler(requestHeaders, requestBody);
    const responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody.QueryExecution).toBeDefined();
    expect(responseBody.QueryExecution.Status.State).toEqual(AthenaQueryExecutionState.SUCCEEDED);
  });

  it('should get query results', async () => {
    getAccessTokenMock.mockReturnValue('any');
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

    const athenaMockResultsPageOne = {
      resultSet: {
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
      nextToken: 'page-two',
    };

    requestHeaders['x-amz-target'] = athenaCmds.getQueryResults;
    let requestBody = Buffer.from('{"QueryExecutionId": "mock-execution-id"}').toString('base64');

    API.listQueryResultsAsAthenaResults.mockResolvedValue(athenaMockResultsPageOne);
    let result = await getAthenaProxyHandler(requestHeaders, requestBody);
    let responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody).toStrictEqual({
      ResultSet: athenaMockResultsPageOne.resultSet,
      NextToken: 'page-two',
    });

    requestBody = Buffer.from('{"QueryExecutionId": "mock-execution-id", "NextToken": "page-two"}').toString('base64');
    const athenaMockResultsPageTwo = {
      resultSet: {
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'user-2',
              },
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
    API.listQueryResultsAsAthenaResults.mockResolvedValue(athenaMockResultsPageTwo);
    result = await getAthenaProxyHandler(requestHeaders, requestBody);
    responseBody = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(responseBody).toStrictEqual({
      ResultSet: athenaMockResultsPageTwo.resultSet,
    });
  });
});
