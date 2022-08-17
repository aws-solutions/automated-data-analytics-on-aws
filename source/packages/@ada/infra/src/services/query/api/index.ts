/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CommonQueryParameters, asEntity, asInput } from '../../../common/constructs/api';
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import {
  GeneratedQuery,
  PaginatedQueryResult,
  Query,
  QueryExecution,
  QueryHistory,
  QueryResult,
  QuerySchema,
  QueryStatus,
  SavedQuery,
  SavedQueryList,
} from './types';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { ResponseProps } from '../../../common/constructs/api/federated-api/base';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { TypescriptFunction } from '@ada/infra-common';

/* eslint-disable sonarjs/no-duplicate-string */

const ACTION_EXECUTEAPI_INVOKE = 'execute-api:Invoke';
const PROD = 'prod';

export interface QueryApiProps extends MicroserviceApiProps {
  counterTable: CounterTable;
  athenaQueryExecutorStepFunction: StateMachine;
  dataProductApi: MicroserviceApi;
  athenaOutputBucket: Bucket;
  queryGenerateLambda: TypescriptFunction;
  queryHistoryTable: Table;
  cachedQueryTable: Table;
  queryParseRenderApi: MicroserviceApi;
  governanceApi: MicroserviceApi;
  savedPrivateQueryTable: Table;
  savedPublicQueryTable: Table;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
}

export interface BuiltLambdaFunctions {
  startQueryExecutionLambda: TypescriptFunction;
  getQueryExecutionStatusLambda: TypescriptFunction;
  getSignedUrlLambda: TypescriptFunction;
  getAthenaQueryResultLambda: TypescriptFunction;
  getAthenaQueryResultAsAthenaLambda: TypescriptFunction;
  startQueryExecutionSyncLambda: TypescriptFunction;
  getAthenaQuerySyncResultLambda: TypescriptFunction;
  getSchemaLambda: TypescriptFunction;
  listQueryHistory: TypescriptFunction;
  listSavedPublicQueries: TypescriptFunction;
  listSavedQueriesInNamespace: TypescriptFunction;
  putSavedQuery: TypescriptFunction;
  getSavedQuery: TypescriptFunction;
  deleteSavedQuery: TypescriptFunction;
}

/**
 * Api for Query Service
 */
export default class QueryApi extends MicroserviceApi {
  readonly functions: BuiltLambdaFunctions;

  constructor(scope: Construct, id: string, props: QueryApiProps) {
    super(scope, id, props);

    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'query-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          ATHENA_OUTPUT_BUCKET_NAME: props.athenaOutputBucket.bucketName,
          ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN: props.athenaQueryExecutorStepFunction.stateMachineArn,
          GET_DATA_PRODUCT_API: props.dataProductApi.url,
          QUERY_HISTORY_TABLE_NAME: props.queryHistoryTable.tableName,
          CACHED_QUERY_TABLE_NAME: props.cachedQueryTable.tableName,
          SAVED_PUBLIC_QUERY_TABLE_NAME: props.savedPublicQueryTable.tableName,
          SAVED_PRIVATE_QUERY_TABLE_NAME: props.savedPrivateQueryTable.tableName,
        },
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        counterTable: props.counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
      });

    this.functions = this.buildLambdas(buildLambda, props);

    this.addRoutes(props);
  }

  private buildLambdas = (
    buildLambda: (handler: string) => TypescriptFunction,
    props: QueryApiProps,
  ): BuiltLambdaFunctions => {
    const startQueryExecutionLambda = buildLambda('start-query-execution');
    props.athenaQueryExecutorStepFunction.grantStartExecution(startQueryExecutionLambda);
    props.queryHistoryTable.grantReadWriteData(startQueryExecutionLambda);

    const startQueryExecutionSyncLambda = buildLambda('start-query-execution-sync');
    props.athenaQueryExecutorStepFunction.grantStartExecution(startQueryExecutionSyncLambda);
    props.queryHistoryTable.grantReadWriteData(startQueryExecutionLambda);

    const getQueryExecutionStatusLambda = buildLambda('get-query-execution-status');
    props.athenaQueryExecutorStepFunction.grantRead(getQueryExecutionStatusLambda);

    const getSignedUrlLambda = buildLambda('get-signed-url');
    props.athenaQueryExecutorStepFunction.grantRead(getSignedUrlLambda);
    props.athenaOutputBucket.grantRead(getSignedUrlLambda);

    const getAthenaQueryResultLambda = buildLambda('get-athena-query-result');

    const getAthenaQuerySyncResultLambda = buildLambda('get-query-sync-result');

    const getAthenaQueryResultAsAthenaLambda = buildLambda('get-query-result-as-athena-result');

    [getAthenaQueryResultLambda, getAthenaQuerySyncResultLambda, getAthenaQueryResultAsAthenaLambda].forEach(
      (lambda) => {
        props.athenaQueryExecutorStepFunction.grantRead(lambda);
        props.athenaOutputBucket.grantRead(lambda);
        props.cachedQueryTable.grantReadWriteData(lambda);
        lambda.addToRolePolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['athena:GetQueryResults'],
            resources: ['*'],
          }),
        );
        lambda.addToRolePolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [ACTION_EXECUTEAPI_INVOKE],
            resources: [
              props.queryParseRenderApi.arnForExecuteApi('POST', '/discover', PROD),
              props.dataProductApi.arnForExecuteApi('GET', '/domain/*/data-product/*', PROD),
              props.governanceApi.arnForExecuteApi('GET', '/policy/domain/*/data-product/*/permissions', PROD),
            ],
          }),
        );
      },
    );

    const getSchemaLambda = buildLambda('get-schema');
    props.athenaOutputBucket.grantReadWrite(getSchemaLambda);
    getSchemaLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['athena:StartQueryExecution', 'athena:GetQueryExecution'],
        resources: ['*'],
      }),
    );
    getSchemaLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['glue:Get*'],
        resources: ['*'],
      }),
    );
    getSchemaLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [ACTION_EXECUTEAPI_INVOKE],
        resources: [props.dataProductApi.arnForExecuteApi('GET', '/domain/*/data-product/*', PROD)],
      }),
    );

    const listQueryHistory = buildLambda('list-query-history');
    props.queryHistoryTable.grantReadData(listQueryHistory);

    const listSavedPublicQueries = buildLambda('list-saved-public-queries');
    props.savedPublicQueryTable.grantReadData(listSavedPublicQueries);
    const listSavedQueriesInNamespace = buildLambda('list-saved-queries-in-namespace');
    props.savedPublicQueryTable.grantReadData(listSavedQueriesInNamespace);
    props.savedPrivateQueryTable.grantReadData(listSavedQueriesInNamespace);

    const getSavedQuery = buildLambda('get-saved-query');
    props.savedPublicQueryTable.grantReadData(getSavedQuery);
    props.savedPrivateQueryTable.grantReadData(getSavedQuery);

    const putSavedQuery = buildLambda('put-saved-query');
    props.savedPublicQueryTable.grantReadWriteData(putSavedQuery);
    props.savedPrivateQueryTable.grantReadWriteData(putSavedQuery);
    props.cachedQueryTable.grantReadWriteData(putSavedQuery);
    putSavedQuery.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [ACTION_EXECUTEAPI_INVOKE],
        resources: [
          props.queryParseRenderApi.arnForExecuteApi('POST', '/discover', PROD),
          this.arnForExecuteApi('GET', '/saved-query/*', PROD),
          props.dataProductApi.arnForExecuteApi('GET', '/domain/*', PROD),
          props.dataProductApi.arnForExecuteApi('GET', '/domain/*/data-product/*', PROD),
        ],
      }),
    );

    const deleteSavedQuery = buildLambda('delete-saved-query');
    props.savedPublicQueryTable.grantReadWriteData(deleteSavedQuery);
    props.savedPrivateQueryTable.grantReadWriteData(deleteSavedQuery);

    return {
      startQueryExecutionLambda,
      getQueryExecutionStatusLambda,
      getSignedUrlLambda,
      getAthenaQueryResultLambda,
      getAthenaQueryResultAsAthenaLambda,
      startQueryExecutionSyncLambda,
      getAthenaQuerySyncResultLambda,
      getSchemaLambda,
      listQueryHistory,
      listSavedPublicQueries,
      listSavedQueriesInNamespace,
      putSavedQuery,
      getSavedQuery,
      deleteSavedQuery,
    };
  };

  private addRoutes(props: QueryApiProps) {
    const redirectSyncQueryResponse = (name: string): ResponseProps => ({
      // Redirect to the sync query result api
      responseStatusCode: StatusCodes.SEE_OTHER,
      name,
      description: 'A redirect to the query result api',
      schema: {},
      responseHeaders: {
        location: true,
      },
      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
    });

    this.api.addRoutes({
      // POST /query
      POST: {
        integration: new LambdaIntegration(this.functions.startQueryExecutionLambda),
        request: {
          name: 'StartQueryInput',
          description: 'The query to execute',
          schema: Query,
        },
        response: {
          name: 'StartQueryOutput',
          description: 'An execution id to track the status or retrieve the result of a query',
          schema: QueryExecution,
          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
        },
      },
      paths: {
        // /query/history
        '/history': {
          // GET /query/history
          GET: {
            integration: new LambdaIntegration(this.functions.listQueryHistory),
            requestParameters: {},
            paginated: true,
            response: {
              name: 'GetQueryHistoryOutput',
              description: 'The list of queries performed by a specific user, order by execution date (desc)',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  queries: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(QueryHistory),
                  },
                },
                required: ['queries'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
        },
        // /query/saved-query
        '/saved-query': {
          GET: {
            integration: new LambdaIntegration(this.functions.listSavedPublicQueries),
            paginated: true,
            response: {
              name: 'ListSavedPublicQueriesOutput',
              description: 'The list of all public saved queries',
              schema: SavedQueryList,
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            // /query/saved-query/{namespace}
            '{namespace}': {
              // GET /query/saved-query/{namespace}
              GET: {
                operationName: 'listQueryNamespaceSavedQueries',
                integration: new LambdaIntegration(this.functions.listSavedQueriesInNamespace),
                paginated: true,
                response: {
                  name: 'ListSavedQueriesInNamespaceOutput',
                  description: 'The list of queries saved within the given namespace',
                  schema: SavedQueryList,
                  errorStatusCodes: [StatusCodes.NOT_FOUND, StatusCodes.BAD_REQUEST],
                },
              },
              paths: {
                '{queryId}': {
                  // PUT /query/saved-query/{namespace}/{queryId}
                  PUT: {
                    integration: new LambdaIntegration(this.functions.putSavedQuery),
                    request: {
                      name: 'PutSavedQueryInput',
                      description: 'The query to save',
                      schema: asInput(SavedQuery, ['query']),
                    },
                    response: {
                      name: 'PutSavedQueryOutput',
                      description: 'The saved query',
                      schema: asEntity(SavedQuery),
                      errorStatusCodes: [StatusCodes.NOT_FOUND, StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                    },
                  },
                  // GET /query/saved-query/{namespace}/{queryId}
                  GET: {
                    integration: new LambdaIntegration(this.functions.getSavedQuery),
                    response: {
                      name: 'GetSavedQueryOutput',
                      description: 'The saved query',
                      schema: asEntity(SavedQuery),
                      errorStatusCodes: [StatusCodes.NOT_FOUND, StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                    },
                  },
                  // DELETE /query/saved-query/{namespace}/{queryId}
                  DELETE: {
                    integration: new LambdaIntegration(this.functions.deleteSavedQuery),
                    response: {
                      name: 'DeleteSavedQueryOutput',
                      description: 'The saved query that was deleted',
                      schema: asEntity(SavedQuery),
                      errorStatusCodes: [StatusCodes.NOT_FOUND, StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                    },
                  },
                },
              },
            },
          },
        },
        // /query/{executionId}
        '/{executionId}': {
          paths: {
            // /query/{executionId}/status
            '/status': {
              // GET /query/{executionId}/status
              GET: {
                integration: new LambdaIntegration(this.functions.getQueryExecutionStatusLambda),
                response: {
                  name: 'GetQueryStatusOutput',
                  description: 'The status of a query execution',
                  schema: QueryStatus,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
            },
            // /query/{executionId}/result
            '/result': {
              // GET /query/{executionId}/result
              GET: {
                integration: new LambdaIntegration(this.functions.getAthenaQueryResultLambda),
                paginated: true,
                requestParameters: {
                  retrieveDataIntegrity: {
                    in: 'querystring',
                    schema: { type: 'boolean' },
                    required: false,
                  },
                },
                response: {
                  name: 'GetQueryResultOutput',
                  description: 'The result of a query execution',
                  schema: PaginatedQueryResult,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              paths: {
                // /query/{executionId}/result/download
                '/download': {
                  // GET /query/{executionId}/result/download
                  GET: {
                    integration: new LambdaIntegration(this.functions.getSignedUrlLambda),
                    response: {
                      name: 'GetQueryResultDownloadOutput',
                      description: 'A download url for the full result of a query',
                      schema: {
                        id: `${__filename}/QueryDownload`,
                        type: JsonSchemaType.OBJECT,
                        properties: {
                          signedUrl: {
                            type: JsonSchemaType.STRING,
                          },
                        },
                        required: ['signedUrl'],
                      },
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                    },
                  },
                },
              },
            },
            '/result-as-athena': {
              // GET /query/{executionId}/result-as-athena
              GET: {
                integration: new LambdaIntegration(this.functions.getAthenaQueryResultAsAthenaLambda),
                requestParameters: {
                  maxResults: {
                    in: 'querystring',
                    schema: { type: 'integer' },
                    required: false,
                  },
                  nextToken: {
                    in: 'querystring',
                    schema: { type: 'string' },
                    required: false,
                  },
                },
                operationName: 'listQueryResultsAsAthenaResults',
                response: {
                  name: 'GetQueryResultAsAthenaOutput',
                  description: 'The result of a query execution',
                  schema: {
                    id: `${__filename}/PaginatedQueryResultAsAthena`,
                    type: JsonSchemaType.OBJECT,
                    properties: {
                      updateCount: { type: JsonSchemaType.INTEGER },
                      // Skipping strong typing to avoid camlCase conversion by the generator.
                      // Athena ResultSets are all in PascalCase, for more details:
                      // https://docs.aws.amazon.com/athena/latest/APIReference/API_ResultSet.html
                      resultSet: {},
                      nextToken: { type: JsonSchemaType.STRING },
                    },
                  },
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
            },
          },
        },
        // /query/generate
        '/generate': {
          // POST /query/generate
          POST: {
            integration: new LambdaIntegration(props.queryGenerateLambda),
            request: {
              name: 'GenerateQueryInput',
              description: 'The query to generate',
              schema: Query,
            },
            response: {
              name: 'GenerateQueryOutput',
              description: 'The generated query (ie. translated to include governance)',
              schema: GeneratedQuery,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
            },
          },
        },
        // /query/sync
        '/sync': {
          // GET /query/sync?query={query}
          GET: {
            integration: new LambdaIntegration(this.functions.startQueryExecutionSyncLambda),
            requestParameters: {
              query: true,
            },
            response: redirectSyncQueryResponse('GetSyncQueryOutput'),
          },
          paths: {
            // /query/sync/{executionId}
            '/{executionId}': {
              paths: {
                // /query/sync/{executionId}/result
                '/result': {
                  // GET /query/sync/{executionId}/result
                  GET: {
                    integration: new LambdaIntegration(this.functions.getAthenaQuerySyncResultLambda),
                    requestParameters: {
                      ...CommonQueryParameters.Pagination,
                      retrieveDataIntegrity: {
                        in: 'querystring',
                        schema: { type: 'boolean' },
                        required: false,
                      },
                    },
                    // We can either return 200 with the results, or another 303 redirect because the query hasn't completed
                    response: [
                      {
                        name: 'GetQuerySyncResultOutput',
                        description: 'The result of the query',
                        schema: QueryResult,
                        errorStatusCodes: [],
                      },
                      redirectSyncQueryResponse('GetSyncQueryResultRedirectOutput'),
                    ],
                  },
                },
              },
            },
          },
        },
        // /query/schema
        '/schema': {
          paths: {
            // /query/schema/{domainId}
            '/{domainId}': {
              paths: {
                // /query/schema/{domainId}/data-product
                '/data-product': {
                  paths: {
                    // /query/schema/{domainId}/data-product/{dataProductId}
                    '/{dataProductId}': {
                      // GET /query/schema/{dataProductId}
                      GET: {
                        integration: new LambdaIntegration(this.functions.getSchemaLambda),
                        requestParameters: {
                          dataSetId: false,
                        },
                        response: {
                          name: 'GetDataProductSchemaOutput',
                          description: 'The schema for a data product',
                          schema: QuerySchema,
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
