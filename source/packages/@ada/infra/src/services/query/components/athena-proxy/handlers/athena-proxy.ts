/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { Athena } from '@ada/aws-sdk';
import { Logger } from '../../../../../common/constructs/lambda/lambda-logger';
import { PaginatedQueryResultAsAthena } from '@ada/api';
import { VError } from 'verror';
import { getAccessToken } from '../../../../../common/services/utils/cognito';

export const athenaCmds = {
  createPreparedStatement: 'AmazonAthena.CreatePreparedStatement',
  deletePreparedStatement: 'AmazonAthena.DeletePreparedStatement',
  getQueryExecution: 'AmazonAthena.GetQueryExecution',
  getQueryResults: 'AmazonAthena.GetQueryResults',
  getTableMetadata: 'AmazonAthena.GetTableMetadata',
  getWorkGroup: 'AmazonAthena.GetWorkGroup',
  listDataCatalogs: 'AmazonAthena.ListDataCatalogs',
  listDatabases: 'AmazonAthena.ListDatabases',
  listTableMetadata: 'AmazonAthena.ListTableMetadata',
  startQueryExecution: 'AmazonAthena.StartQueryExecution',
  stopQueryExecution: 'AmazonAthena.StopQueryExecution',
};

const DEFAULT_DATASET_NAME = 'ada_default_dataset';

const isRequestFromCloudFront = (event: APIGatewayProxyEvent): boolean => {
  const headers = event.headers;

  return (
    !!headers['user-agent'] &&
    !!headers.via &&
    headers['user-agent']!.toLocaleLowerCase().includes('cloudfront') &&
    headers.via!.toLocaleLowerCase().includes('.cloudfront.net') &&
    !!headers['x-amz-cf-id']
  );
};

const logger = new Logger({ tags: ['athenaProxy'] });

export const handler = async (event: APIGatewayProxyEvent, _context?: Context): Promise<APIGatewayProxyResult> => {
  logger.info('athenaproxy::handler starts');
  const authToken = event.headers.Authorization || event.headers.authorization || '';

  if (!isRequestFromCloudFront(event)) {
    throw new Error('Unexpected request');
  }

  const basicAuth = extractAPIKey(authToken);
  // consider to cache as this access token is valid for 1 day
  const accessToken = await getAccessToken(basicAuth);

  if (!accessToken) {
    throw new Error('Error retrieving the access token');
  }

  const api = ApiClient.createWithAccessToken(accessToken);

  const target = event.headers['x-amz-target'] || '';
  if (!target) {
    throw new VError({ name: 'MissingX-AMZ-Target-Error' }, 'Missing x-amz-target');
  }

  let reqBodyJSON;
  if (event.body) {
    const base64DecodedBody = Buffer.from(event.body, 'base64');
    logger.debug(base64DecodedBody.toString());
    reqBodyJSON = JSON.parse(base64DecodedBody.toString());
  }

  let responseBody;
  try {
    switch (target) {
      case athenaCmds.listDataCatalogs:
        responseBody = await listDataCatalogs(api, reqBodyJSON);
        break;
      case athenaCmds.listDatabases:
        responseBody = await listDatabases(api, reqBodyJSON);
        break;
      case athenaCmds.listTableMetadata:
        responseBody = await listTableMetadata(api, reqBodyJSON);
        break;
      case athenaCmds.getTableMetadata:
        responseBody = await getTableMetadata(api, reqBodyJSON);
        break;
      case athenaCmds.startQueryExecution:
        responseBody = await startQueryExecution(api, reqBodyJSON);
        break;
      case athenaCmds.stopQueryExecution:
        responseBody = await stopQueryExecution(api, reqBodyJSON);
        break;
      case athenaCmds.getWorkGroup:
        responseBody = await getWorkGroup(api, reqBodyJSON);
        break;
      case athenaCmds.getQueryExecution:
        responseBody = await getQueryExecution(api, reqBodyJSON);
        break;
      case athenaCmds.getQueryResults:
        responseBody = await getPaginatedQueryResults(api, reqBodyJSON);
        break;
      case athenaCmds.createPreparedStatement:
      case athenaCmds.deletePreparedStatement:
      default:
        responseBody = '';
        break;
    }
  } catch (err: any) {
    logger.error('Error processing the request', { err });

    throw new VError({ name: 'InternalServerError', cause: err }, `Internal Server Error`);
  }

  return {
    statusCode: 200,
    body: responseBody ? JSON.stringify(responseBody) : '',
  } as APIGatewayProxyResult
};

export const extractAPIKey = (authToken: string) => {
  const pattern = new RegExp(/AWS4-HMAC-SHA256\sCredential=api-key\s(.*?)\//, 'ig');
  const matched = pattern.exec(authToken);
  if (!matched || matched.length < 2) {
    throw new VError({ name: 'MissingApiKeyError' }, 'Unauthorized - missing api-key');
  }
  return matched[1];
};

/**
 * Lists the data catalogs in the current AWS account.
 * Proxy for domain list
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_ListDataCatalogs.html
 **/
const listDataCatalogs = async (
  api: ApiClient,
  _request: Athena.ListTableMetadataInput,
): Promise<Athena.ListDataCatalogsOutput> => {
  const adaResponse = await api.listDataProductDomains({});
  const domains = adaResponse.domains || [];
  // jdbc and odbc driver requires default AwsDataCatalog to be present before it can return external catalogs
  const result = {
    DataCatalogsSummary: [
      {
        CatalogName: 'AwsDataCatalog',
        Description: 'AwsDataCatalog',
        Type: 'HIVE',
      },
    ],
  };
  domains.forEach((domain) => {
    result.DataCatalogsSummary.push({
      CatalogName: domain.domainId,
      Description: domain.name,
      Type: 'HIVE',
    });
  });
  return result;
};

/**
 * Lists the databases in the specified data catalog.
 * Proxy for data product list
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_ListDatabases.html
 **/
const listDatabases = async (
  api: ApiClient,
  request: Athena.ListDatabasesInput,
): Promise<Athena.ListDatabasesOutput> => {
  if (!request.CatalogName) {
    throw Error('Invalid request, missing catalog name: ' + request);
  }
  const adaResponse = await api.listDataProductDomainDataProducts({ domainId: request.CatalogName });
  const dataProducts = adaResponse.dataProducts;
  const result: Athena.ListDatabasesOutput = {
    DatabaseList: [] as Athena.DatabaseList,
  };
  dataProducts.forEach((dataProduct) => {
    result.DatabaseList!.push({
      Description: dataProduct.name,
      Name: dataProduct.dataProductId,
      Parameters: {
        Id: dataProduct.dataProductId,
      },
    });
  });
  return result;
};

/**
 * Lists the metadata for the tables in the specified data catalog database.
 * Proxy for data set list
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_ListTableMetadata.html
 **/
const listTableMetadata = async (
  api: ApiClient,
  request: Athena.ListTableMetadataInput,
): Promise<Athena.ListTableMetadataOutput> => {
  if (!request.CatalogName || !request.DatabaseName) {
    throw Error('Invalid request - missing catalog or database name. ' + request);
  }
  const result: Athena.ListTableMetadataOutput = {
    TableMetadataList: [] as Athena.TableMetadataList,
  };
  try {
    const dataProduct = await api.getDataProductDomainDataProduct({
      domainId: request.CatalogName,
      dataProductId: request.DatabaseName,
    });

    const datasetKeys = Object.keys(dataProduct.dataSets);
    for (const key in dataProduct.dataSets) {
      if (key === DEFAULT_DATASET_NAME && datasetKeys.length > 1) {
        continue;
      }
      const tableMetadata: Athena.TableMetadata = {
        CreateTime: dataProduct.createdTimestamp ? new Date(dataProduct.createdTimestamp) : undefined,
        Name: dataProduct.dataProductId,
        TableType: 'EXTERNAL_TABLE',
        Columns: [] as Athena.ColumnList,
        Parameters: {
          datasetName: key,
        },
      };
      const columnMetadata = dataProduct.dataSets[key].columnMetadata;
      for (const columnName in columnMetadata) {
        tableMetadata.Name = key;
        tableMetadata.Columns!.push({
          Comment: columnName,
          Name: columnName,
          Type: columnMetadata[columnName].dataType,
        });
      }
      result.TableMetadataList!.push(tableMetadata);
    }
  } catch (error) {
    logger.error('Error listing table metadata.', {
      catalogName: request.CatalogName,
      databaseName: request.DatabaseName,
      err: error,
    });
  }
  return result;
};

/**
 * Returns table metadata for the specified catalog, database, and table.
 * Proxy for returning data set metadata
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_GetTableMetadata.html
 **/
const getTableMetadata = async (
  api: ApiClient,
  request: Athena.GetTableMetadataInput,
): Promise<Athena.GetTableMetadataOutput> => {
  try {
    const dataProduct = await api.getDataProductDomainDataProduct({
      domainId: request.CatalogName,
      dataProductId: request.DatabaseName,
    });
    const dataSet = dataProduct.dataSets[request.TableName];
    if (dataSet) {
      const result = {
        TableMetadata: {
          CreateTime: dataProduct.createdTimestamp ? new Date(dataProduct.createdTimestamp) : undefined,
          Name: request.TableName,
          TableType: 'EXTERNAL_TABLE',
          Columns: [] as Athena.ColumnList,
        },
      };
      const columnMetadata = dataSet.columnMetadata;
      for (const columnName in columnMetadata) {
        result.TableMetadata.Columns.push({
          Comment: columnName,
          Name: columnName,
          Type: columnMetadata[columnName].dataType,
        });
      }
      return result;
    }
  } catch (error) {
    logger.error('Error getting table metadata.', {
      catalogName: request.CatalogName,
      catabaseName: request.DatabaseName,
      err: error,
    });
  }
  return {};
};

/**
 * Runs the SQL query statements contained in the Query. Requires you to have access to the workgroup in which the query ran.
 * Proxy for executing query
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html
 **/
const startQueryExecution = async (
  api: ApiClient,
  request: Athena.StartQueryExecutionInput,
): Promise<Athena.StartQueryExecutionOutput> => {
  if (!request.QueryString) {
    throw Error('Invalid request - missing query string');
  }
  const catalogName = request.QueryExecutionContext?.Catalog;
  const requestQuery = getFullyQualifiedTableName(request.QueryString, catalogName);
  const queryExecutionRes = await api.postQuery({ query: { query: requestQuery } });
  logger.info('ExecutionId: ', { executionId: queryExecutionRes.executionId });
  return {
    QueryExecutionId: queryExecutionRes.executionId,
  };
};

/**
 * jdbc does not parse fully qualified name that includes domain name, however odbc does
 * this function is intended to inject the domain name to the query
 * The regex looks up for table name after the FROM key word, and if it has a single dot, it will prepend the domain name
 * e.g. select * from social.post => select * from domain.social.post
 * Need to support queries within the context of a domain in the query-parser in later release
 */
export const getFullyQualifiedTableName = (query: string, domainName?: string) => {
  if (query.toLowerCase().indexOf('custom sql') > -1) {
    return query;
  }
  const pattern = new RegExp(`(?<=.*FROM\\s)(?!\\"?${domainName}\\"?\\.)([^.\\s]+\\.[^.\\s]+\\s)`, 'igm');
  console.log(pattern);
  if (pattern.exec(query) && !domainName) {
    throw Error('Invalid request - no domain name found to rewrite query');
  }
  return query.replace(pattern, `"${domainName}".$1`);
};

/**
 * Stops a query execution. Requires you to have access to the workgroup in which the query ran.
 * Proxy for stop querying, no implementation
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_StopQueryExecution.html
 *
 **/
const stopQueryExecution = async (
  _api: ApiClient,
  request: Athena.StopQueryExecutionInput,
): Promise<Athena.StopQueryExecutionOutput> => {
  // no implementation at Ada level for stop query
  // const stopQueryRes = await api.stopQuery({executionId: request.QueryExecutionId});
  return {
    QueryExecutionId: request.QueryExecutionId,
  };
};

/**
 * Returns information about a single execution of a query if you have access to the workgroup in which the query ran. Each time a query executes, information about the query execution is saved with a unique ID.
 * Proxy for get query execution status
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryExecution.html
 *
 **/
const getQueryExecution = async (
  api: ApiClient,
  request: Athena.GetQueryExecutionInput,
): Promise<Athena.GetQueryExecutionOutput> => {
  const getQueryExecStatusRes = await api.getQueryStatus({ executionId: request.QueryExecutionId });
  return {
    QueryExecution: {
      Status: {
        State: getQueryExecStatusRes.status,
      },
    },
  };
};

/**
 * Streams the results of a single query execution specified by QueryExecutionId from the Athena query results location in Amazon S3.
 * Proxy for query results
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryResults.html
 **/
const getPaginatedQueryResults = async (
  api: ApiClient,
  request: Athena.GetQueryResultsInput,
): Promise<Athena.GetQueryResultsOutput> => {
  if (!request.QueryExecutionId) {
    throw Error('Invalid request - missing QueryExecutionId');
  }
  const getQueryResultsRes: PaginatedQueryResultAsAthena = await api.listQueryResultsAsAthenaResults({
    executionId: request.QueryExecutionId,
    nextToken: request.NextToken,
    maxResults: request.MaxResults,
  });

  return {
    NextToken: getQueryResultsRes.nextToken,
    ResultSet: getQueryResultsRes.resultSet,
    UpdateCount: getQueryResultsRes.updateCount,
  } as Athena.GetQueryResultsOutput;
};

/**
 * Returns information about the workgroup with the specified name.
 * Proxy to get work group
 *
 * @see https://docs.aws.amazon.com/athena/latest/APIReference/API_GetWorkGroup.html
 **/
const getWorkGroup = async (
  _api: ApiClient,
  _request: Athena.GetWorkGroupInput,
): Promise<Athena.GetWorkGroupOutput> => {
  return {
    WorkGroup: {
      Name: 'primary',
      State: 'ENABLED',
      Configuration: {
        ResultConfiguration: {},
        EnforceWorkGroupConfiguration: false,
        PublishCloudWatchMetricsEnabled: true,
        RequesterPaysEnabled: false,
        EngineVersion: {
          SelectedEngineVersion: 'Athena engine version 2',
          EffectiveEngineVersion: 'Athena engine version 2',
        },
      },
    },
  };
};
