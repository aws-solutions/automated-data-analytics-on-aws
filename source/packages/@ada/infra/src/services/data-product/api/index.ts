/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint quote-props: off */
import { ArnFormat, Duration, Stack } from 'aws-cdk-lib';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { CfnPolicy, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { DATA_PRODUCT_SECRET_PREFIX } from '../../../common/constructs/iam/policies';
import { DESCRIPTION_VALIDATION, FILEUPLOAD_SUPPORTED_CONTENTTYPES, S3Location } from '@ada/common';
import {
  DataProduct,
  Domain,
  GovernedDataProduct,
  Script,
  ScriptSourceValidationInput,
  ScriptSourceValidationOutput,
  TableStream,
} from './types';
import {
  DataProductEventDetailTypes,
  EventSource,
  MicroserviceApi,
  MicroserviceApiProps,
} from '@ada/microservice-common';
import { Database } from '@aws-cdk/aws-glue-alpha';
import {
  DynamicInfraDeploymentPolicyStatement,
  OperationalMetricsConfig,
  TypescriptFunction,
  TypescriptFunctionProps,
} from '@ada/infra-common';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NotificationBus } from '../../api/components/notification/constructs/bus';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';
import { asEntity, asInput } from '../../../common/constructs/api';
import { configOperationalMetricsClientForLambda } from '../../api/components/operational-metrics/client';
import AthenaQueryExecutorStateMachine from '../../query/components/athena-query-executor-step-function';
import CrawlerPollerStateMachine from '../components/crawler-poller-state-machine';
import DataProductCreationStateMachine from '../components/creation-state-machine';
import DataProductInfraLambdas from '../dynamic-infrastructure/lambdas';
import path from 'path';

export interface DataProductServiceApiProps extends MicroserviceApiProps {
  readonly scriptTable: Table;
  readonly fileUploadBucket: Bucket;
  readonly domainTable: Table;
  readonly dataProductTable: Table;
  readonly dataProductCreationStateMachine: DataProductCreationStateMachine;
  readonly counterTable: CounterTable;
  readonly notificationBus: NotificationBus;
  readonly database: Database;
  readonly crawlerPollerStateMachine: CrawlerPollerStateMachine;
  readonly executeGeneratedQueryStateMachine: AthenaQueryExecutorStateMachine;
  readonly dataBucket: Bucket;
  readonly executeAthenaQueryLambdaRoleArn: string;
  readonly governanceApi: MicroserviceApi;
  readonly ontologyApi: MicroserviceApi;
  readonly internalTokenKey: InternalTokenKey;
  readonly entityManagementTables: EntityManagementTables;
  readonly glueKey: Key;
  readonly glueSecurityConfigurationName: string;
  readonly dataProductInfraLambdas: DataProductInfraLambdas;
  readonly athenaOutputBucket: Bucket;
  readonly scriptBucket: Bucket;
  readonly staticInfraParameter: StringParameter;
  readonly accessLogsBucket: Bucket;
  readonly operationalMetricsConfig: OperationalMetricsConfig;
}

export interface BuiltLambdaFunctions {
  getScriptLambda: TypescriptFunction;
  getTableStreamLambda: TypescriptFunction;
  listScriptLambda: TypescriptFunction;
  putScriptLambda: TypescriptFunction;
  deleteScriptLambda: TypescriptFunction;
  putDomainLambda: TypescriptFunction;
  listDomainLambda: TypescriptFunction;
  getDomainLambda: TypescriptFunction;
  deleteDomainLambda: TypescriptFunction;
  putDataProductLambda: TypescriptFunction;
  postDataProductLambda: TypescriptFunction;
  listDataProductLambda: TypescriptFunction;
  getDataProductLambda: TypescriptFunction;
  deleteDataProductLambda: TypescriptFunction;
  putStartDataProductDataUpdateLambda: TypescriptFunction;
  eventBridgeUpdateDataProduct: TypescriptFunction;
  getSignedUrlLambda: TypescriptFunction;
  postMultipartUpload: TypescriptFunction;
  putMultipartUpload: TypescriptFunction;
  validateScriptLambda: PythonFunction;
}

/**
 * Api construct for data product service
 */
export default class DataProductApi extends MicroserviceApi {
  public readonly functions: BuiltLambdaFunctions;

  constructor(scope: Construct, id: string, props: DataProductServiceApiProps) {
    super(scope, id, props);

    const buildLambdaHandler = (handlerFile: string, additionalProps?: Partial<TypescriptFunctionProps>) => {
      const lambda = new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'data-product-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          SCRIPT_TABLE_NAME: props.scriptTable.tableName,
          SCRIPT_BUCKET_NAME: props.scriptBucket.bucketName,
          DOMAIN_TABLE_NAME: props.domainTable.tableName,
          DATA_PRODUCT_TABLE_NAME: props.dataProductTable.tableName,
          CREATE_DATA_PRODUCT_STATE_MACHINE_ARN: props.dataProductCreationStateMachine.stateMachine.stateMachineArn,
          DATA_PRODUCT_STATIC_INFRASTRUCTURE_PARAMETER_NAME: props.staticInfraParameter.parameterName,
          DATA_PRODUCT_GLUE_DATABASE_NAME: props.database.databaseName,
          GOVERNANCE_PERMISSIONS_API: props.governanceApi.url,
          FILE_UPLOAD_BUCKET_NAME: props.fileUploadBucket.bucketName,
          ATHENA_EXECUTE_QUERY_ROLE_ARN: props.executeAthenaQueryLambdaRoleArn,
          ATHENA_OUTPUT_BUCKET_NAME: props.athenaOutputBucket.bucketName,
        },
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        notificationBus: props.notificationBus,
        counterTable: props.counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
        ...additionalProps,
      });
      props.staticInfraParameter.grantRead(lambda);
      return lambda;
    };

    this.functions = this.buildLambdas(buildLambdaHandler, props);

    this.addRoutes();
    this.addEventHandlers(props);
  }

  private buildLambdas = (
    buildLambda: (handler: string, additionalProps?: Partial<TypescriptFunctionProps>) => TypescriptFunction,
    props: DataProductServiceApiProps,
  ): BuiltLambdaFunctions => {
    const getScriptLambda = buildLambda('get-script');
    const listScriptLambda = buildLambda('list-script');
    const putScriptLambda = buildLambda('put-script');
    const deleteScriptLambda = buildLambda('delete-script');

    props.scriptTable.grantReadWriteData(putScriptLambda);
    props.scriptTable.grantReadWriteData(deleteScriptLambda);
    props.scriptTable.grantReadData(getScriptLambda);
    props.scriptTable.grantReadData(listScriptLambda);
    props.scriptBucket.grantRead(getScriptLambda);
    props.scriptBucket.grantPut(putScriptLambda);
    props.scriptBucket.grantRead(deleteScriptLambda);
    props.scriptBucket.grantDelete(deleteScriptLambda);

    const putDomainLambda = buildLambda('put-domain');
    props.domainTable.grantReadWriteData(putDomainLambda);
    const getDomainLambda = buildLambda('get-domain');
    props.domainTable.grantReadData(getDomainLambda);
    const listDomainLambda = buildLambda('list-domain');
    props.domainTable.grantReadData(listDomainLambda);
    const deleteDomainLambda = buildLambda('delete-domain');
    props.domainTable.grantReadWriteData(deleteDomainLambda);

    const getTableStreamLambda = buildLambda('get-table-stream');
    getTableStreamLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:DescribeTable'],
        resources: ['*'],
      }),
    );

    const buildDataProductLambda = buildLambda('build-data-product', { timeout: Duration.minutes(15) });
    props.dataProductTable.grantReadWriteData(buildDataProductLambda);
    // Grant access to run queries since
    buildDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: [props.executeAthenaQueryLambdaRoleArn],
      }),
    );
    buildDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['athena:GetQueryExecution'],
        resources: ['*'],
      }),
    );
    props.fileUploadBucket.grantRead(buildDataProductLambda);
    props.fileUploadBucket.grantDelete(buildDataProductLambda);

    const putDataProductLambda = buildLambda('put-data-product');
    props.dataProductTable.grantReadWriteData(putDataProductLambda);

    const postDataProductLambda = buildLambda('post-data-product');
    buildDataProductLambda.grantInvoke(postDataProductLambda);
    postDataProductLambda.addEnvironment('BUILD_DATA_PRODUCT_LAMBDA_ARN', buildDataProductLambda.functionArn);
    props.dataProductTable.grantReadWriteData(postDataProductLambda);
    props.dataProductCreationStateMachine.stateMachine.grantStartExecution(postDataProductLambda);
    postDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsManager:CreateSecret'],
        resources: [
          Stack.of(this).formatArn({
            resource: 'secret',
            service: 'secretsmanager',
            resourceName: `${DATA_PRODUCT_SECRET_PREFIX}*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );

    configOperationalMetricsClientForLambda(postDataProductLambda, props.operationalMetricsConfig);

    const getDataProductLambda = buildLambda('get-data-product');
    props.dataProductTable.grantReadData(getDataProductLambda);
    getDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['states:ListExecutions'],
        resources: ['*'],
      }),
    );
    addCfnNagSuppressionsToRolePolicy(getDataProductLambda.role!, [
      {
        id: 'W12',
        reason:
          'Get data product api is allowed to read status of all data product state machines, and arns are not known until runtime',
      },
    ]);

    const deleteDataProductLambda = buildLambda('delete-data-product');
    props.dataProductTable.grantReadWriteData(deleteDataProductLambda);
    deleteDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudformation:DeleteStack'],
        resources: props.dataProductCreationStateMachine.cloudformationResourceArns,
      }),
    );
    deleteDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['states:ListExecutions'],
        resources: [
          Stack.of(this).formatArn({
            resource: 'stateMachine',
            service: 'states',
            resourceName: 'StateMachine*',
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
    deleteDataProductLambda.addToRolePolicy(DynamicInfraDeploymentPolicyStatement);
    deleteDataProductLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsmanager:DeleteSecret'],
        resources: [
          Stack.of(this).formatArn({
            resource: 'secret',
            service: 'secretsmanager',
            resourceName: `${DATA_PRODUCT_SECRET_PREFIX}*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );

    configOperationalMetricsClientForLambda(deleteDataProductLambda, props.operationalMetricsConfig);

    (deleteDataProductLambda.role!.node.findChild('DefaultPolicy').node.defaultChild as CfnPolicy).addMetadata(
      'cfn_nag',
      {
        rules_to_suppress: [
          { id: 'F4', reason: 'Used to delete the CloudFormation stack' },
          { id: 'F39', reason: 'Used to delete the CloudFormation stack' },
        ],
      },
    );

    const listDataProductLambda = buildLambda('list-data-product');
    props.dataProductTable.grantReadData(listDataProductLambda);
    const putStartDataProductDataUpdateLambda = buildLambda('put-start-data-product-data-update');
    props.dataProductTable.grantReadWriteData(putStartDataProductDataUpdateLambda);

    const eventBridgeUpdateDataProduct = buildLambda('event-bridge/update-data-product');
    props.dataProductTable.grantReadWriteData(eventBridgeUpdateDataProduct);

    const getSignedUrlLambda = buildLambda('get-signed-url');
    props.fileUploadBucket.grantPut(getSignedUrlLambda);

    const postMultipartUpload = buildLambda('post-multipart-upload');
    props.fileUploadBucket.grantPut(postMultipartUpload);

    const putMultipartUpload = buildLambda('put-multipart-upload');
    props.fileUploadBucket.grantPut(putMultipartUpload);

    const validateScriptLambda = new PythonFunction(this, 'ValidateScriptHandler', {
      entry: path.resolve(__dirname, '../script-validation'),
      description: 'Validate customer-provided transform scripts for vulnerabilities',
      runtime: Runtime.PYTHON_3_9,
      index: 'handler/index.py',
      handler: 'handler',
      timeout: Duration.seconds(30),
    });

    return {
      getScriptLambda,
      listScriptLambda,
      putScriptLambda,
      deleteScriptLambda,
      putDomainLambda,
      getDomainLambda,
      getTableStreamLambda,
      listDomainLambda,
      deleteDomainLambda,
      putDataProductLambda,
      postDataProductLambda,
      getDataProductLambda,
      listDataProductLambda,
      deleteDataProductLambda,
      putStartDataProductDataUpdateLambda,
      eventBridgeUpdateDataProduct,
      getSignedUrlLambda,
      postMultipartUpload,
      putMultipartUpload,
      validateScriptLambda,
    };
  };

  private addEventHandlers = (props: DataProductServiceApiProps) => {
    const rule = props.notificationBus.addRule('DynamicInfraToDataProductRule', {
      // ruleName: 'dynamic-infra-to-data-product',
      description: 'Rule matching events from the dynamic infrastracture to update data products information',
      notificationPattern: {
        source: [EventSource.DATA_PRODUCTS],
        type: [
          DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
          DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR,
          DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS_NO_UPDATE,
        ],
      },
    });

    rule.addTarget(new LambdaFunction(this.functions.eventBridgeUpdateDataProduct));
  };

  private addRoutes() {
    this.api.addRoutes({
      paths: {
        // /data-product/domain
        '/domain': {
          // GET /data-product/domain
          GET: {
            integration: new LambdaIntegration(this.functions.listDomainLambda),
            paginated: true,
            response: {
              name: 'GetDomainsOutput',
              description: 'The list of all domains',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  domains: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(Domain),
                  },
                },
                required: ['domains'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            // /data-product/domain/{domainId}
            '/{domainId}': {
              // PUT /data-product/domain/{domainId}
              PUT: {
                integration: new LambdaIntegration(this.functions.putDomainLambda),
                request: {
                  name: 'PutDomainInput',
                  description: 'Details about the new domain',
                  schema: asInput(Domain, ['name']),
                },
                response: {
                  name: 'PutDomainOutput',
                  description: 'The created/updated domain',
                  schema: asEntity(Domain),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              // GET /data-product/domain/{domainId}
              GET: {
                integration: new LambdaIntegration(this.functions.getDomainLambda),
                response: {
                  name: 'GetDomainOutput',
                  description: 'The domain with the given id',
                  schema: asEntity(Domain),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              // DELETE /data-product/domain/{domainId}
              DELETE: {
                integration: new LambdaIntegration(this.functions.deleteDomainLambda),
                response: {
                  name: 'DeleteDomainOutput',
                  description: 'The domain that was deleted',
                  schema: asEntity(Domain),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              paths: {
                // /data-product/domain/{domainId}/data-products
                '/data-product': {
                  // GET /data-product/domain/{domainId}/data-products
                  GET: {
                    integration: new LambdaIntegration(this.functions.listDataProductLambda),
                    paginated: true,
                    response: {
                      name: 'GetDataProductsOutput',
                      description: 'The list of all data products',
                      schema: {
                        type: JsonSchemaType.OBJECT,
                        properties: {
                          dataProducts: {
                            type: JsonSchemaType.ARRAY,
                            items: asEntity(DataProduct),
                          },
                        },
                        required: ['dataProducts'],
                      },
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                    },
                  },
                  paths: {
                    // /data-product/domain/{domainId}/data-products/{dataProductId}
                    '/{dataProductId}': {
                      // POST /data-product/domain/{domainId}/data-products/{dataProductId}
                      POST: {
                        integration: new LambdaIntegration(this.functions.postDataProductLambda),
                        requestParameters: {
                          initialFullAccessGroups: {
                            required: false,
                            schema: {
                              type: 'array',
                              items: {
                                type: 'string',
                              },
                            },
                          },
                        },
                        request: {
                          name: 'PostDataProductInput',
                          description: 'Details about the new data product',
                          schema: asInput(DataProduct, ['name', 'sourceType', 'tags', 'transforms', 'updateTrigger']),
                        },
                        response: {
                          name: 'PostDataProductOutput',
                          description: 'The created data product',
                          schema: asEntity(DataProduct),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                      // PUT /data-product/domain/{domainId}/data-products/{dataProductId}
                      PUT: {
                        integration: new LambdaIntegration(this.functions.putDataProductLambda),
                        requestParameters: {
                          initialFullAccessGroups: {
                            required: false,
                            schema: {
                              type: 'array',
                              items: {
                                type: 'string',
                              },
                            },
                          },
                        },
                        request: {
                          name: 'PutDataProductInput',
                          description: 'Details about the data product to update',
                          schema: asInput(DataProduct),
                        },
                        response: {
                          name: 'PutDataProductOutput',
                          description: 'The updated data product',
                          schema: asEntity(DataProduct),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                      // GET /data-product/domain/{domainId}/data-products/{dataProductId}
                      GET: {
                        integration: new LambdaIntegration(this.functions.getDataProductLambda),
                        response: {
                          name: 'GetDataProductOutput',
                          description: 'The data product with the given id',
                          schema: asEntity(GovernedDataProduct),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                      // DELETE /data-product/domain/{domainId}/data-products/{dataProductId}
                      DELETE: {
                        integration: new LambdaIntegration(this.functions.deleteDataProductLambda),
                        response: {
                          name: 'DeleteDataProductOutput',
                          description: 'The data product that was deleted',
                          schema: asEntity(DataProduct),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                      paths: {
                        // /data-product/domain/{domainId}/data-products/{dataProductId}/start-data-update
                        '/start-data-update': {
                          // PUT /data-product/domain/{domainId}/data-products/{dataProductId}/start-data-update
                          PUT: {
                            integration: new LambdaIntegration(this.functions.putStartDataProductDataUpdateLambda),
                            response: {
                              name: 'PutStartDataProductDataUpdateOutput',
                              description: 'Details about the data product that we started to update data for',
                              schema: asEntity(DataProduct),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                        },
                        // /data-product/domain/{domainId}/data-products/{dataProductId}/file
                        '/file': {
                          paths: {
                            // /data-product/domain/{domainId}/data-products/{dataProductId}/file/upload
                            '/upload': {
                              paths: {
                                // /data-product/domain/{domainId}/data-products/{dataProductId}/file/upload/{fileName}
                                '{fileName}': {
                                  // GET /data-product/domain/{domainId}/data-products/{dataProductId}/file/upload/{fileName}?contentType={contentType}
                                  GET: {
                                    integration: new LambdaIntegration(this.functions.getSignedUrlLambda),
                                    requestParameters: {
                                      contentType: {
                                        in: 'querystring',
                                        schema: {
                                          type: JsonSchemaType.STRING,
                                          enum: FILEUPLOAD_SUPPORTED_CONTENTTYPES,
                                        },
                                        required: true,
                                      },
                                      uploadId: {
                                        in: 'querystring',
                                        schema: { type: JsonSchemaType.STRING },
                                        required: false,
                                      },
                                      partNumber: {
                                        in: 'querystring',
                                        schema: { type: JsonSchemaType.NUMBER },
                                        required: false,
                                      },
                                    },
                                    response: {
                                      name: 'GetFileUploadOutput',
                                      description: 'An upload url to be used to store the file',
                                      schema: {
                                        id: `${__filename}/DataProductFileUpload`,
                                        type: JsonSchemaType.OBJECT,
                                        properties: {
                                          signedUrl: {
                                            type: JsonSchemaType.STRING,
                                          },
                                          bucket: {
                                            type: JsonSchemaType.STRING,
                                          },
                                          key: {
                                            type: JsonSchemaType.STRING,
                                          },
                                        },
                                        required: ['signedUrl', 'bucket', 'key'],
                                      },
                                      errorStatusCodes: [
                                        StatusCodes.BAD_REQUEST,
                                        StatusCodes.NOT_FOUND,
                                        StatusCodes.FORBIDDEN,
                                      ],
                                    },
                                  },
                                  // POST /data-product/domain/{domainId}/data-products/{dataProductId}/file/upload/{fileName}?contentType={contentType}
                                  POST: {
                                    integration: new LambdaIntegration(this.functions.postMultipartUpload),
                                    requestParameters: {
                                      contentType: {
                                        in: 'querystring',
                                        schema: {
                                          type: JsonSchemaType.STRING,
                                          enum: FILEUPLOAD_SUPPORTED_CONTENTTYPES,
                                        },
                                        required: true,
                                      },
                                    },
                                    response: {
                                      name: 'PostMultipartFileUploadOutput',
                                      description: 'An uploadId to be used for the subsequent invocations',
                                      schema: {
                                        id: `${__filename}/DataProductMultipartFileUploadStarted`,
                                        type: JsonSchemaType.OBJECT,
                                        properties: {
                                          uploadId: {
                                            type: JsonSchemaType.STRING,
                                          },
                                          bucket: {
                                            type: JsonSchemaType.STRING,
                                          },
                                          key: {
                                            type: JsonSchemaType.STRING,
                                          },
                                        },
                                        required: ['uploadId', 'bucket', 'key'],
                                      },
                                      errorStatusCodes: [
                                        StatusCodes.BAD_REQUEST,
                                        StatusCodes.NOT_FOUND,
                                        StatusCodes.FORBIDDEN,
                                      ],
                                    },
                                  },
                                  // PUT /data-product/domain/{domainId}/data-products/{dataProductId}/file/upload/{fileName}?uploadId={uploadId}
                                  PUT: {
                                    integration: new LambdaIntegration(this.functions.putMultipartUpload),
                                    requestParameters: {
                                      uploadId: {
                                        in: 'querystring',
                                        schema: { type: JsonSchemaType.STRING },
                                        required: true,
                                      },
                                    },
                                    request: {
                                      name: 'PutMultipartFileUploadInput',
                                      description: 'Details about the uploaded parts',
                                      schema: {
                                        id: `${__filename}/FileUploadInput`,
                                        type: JsonSchemaType.OBJECT,
                                        properties: {
                                          parts: {
                                            type: JsonSchemaType.ARRAY,
                                            items: {
                                              type: JsonSchemaType.OBJECT,
                                              properties: {
                                                etag: {
                                                  type: JsonSchemaType.STRING,
                                                  ...DESCRIPTION_VALIDATION,
                                                },
                                                partNumber: {
                                                  type: JsonSchemaType.NUMBER,
                                                },
                                              },
                                              required: ['etag', 'partNumber'],
                                            },
                                          },
                                        },
                                        required: ['parts'],
                                      },
                                    },
                                    response: {
                                      name: 'PutMultipartFileUploadOutput',
                                      description: 'Details about the bucket and the object that have been stored',
                                      schema: S3Location,
                                      errorStatusCodes: [
                                        StatusCodes.BAD_REQUEST,
                                        StatusCodes.NOT_FOUND,
                                        StatusCodes.FORBIDDEN,
                                      ],
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
                },
              },
            },
          },
        },
        // /data-product/scripts
        '/scripts': {
          // GET /data-product/scripts
          GET: {
            integration: new LambdaIntegration(this.functions.listScriptLambda),
            paginated: true,
            response: {
              name: 'GetScriptsOutput',
              description: 'The list of all scripts',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  scripts: {
                    type: JsonSchemaType.ARRAY,
                    items: Script,
                  },
                },
                required: ['scripts'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            '/namespace': {
              paths: {
                '/{namespace}': {
                  paths: {
                    '/script': {
                      paths: {
                        '/{scriptId}': {
                          // GET /data-product/scripts/namespace/{namespace}/script/{scriptId}
                          GET: {
                            integration: new LambdaIntegration(this.functions.getScriptLambda),
                            response: {
                              name: 'GetScriptOutput',
                              description: 'The script with the given id',
                              schema: asEntity(Script),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                          // DELETE /data-product/scripts/namespace/{namespace}/script/{scriptId}
                          DELETE: {
                            integration: new LambdaIntegration(this.functions.deleteScriptLambda),
                            response: {
                              name: 'DeleteScriptOutput',
                              description: 'The script that was deleted',
                              schema: asEntity(Script),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                          // PUT /data-product/scripts/namespace/{namespace}/script/{scriptId}
                          PUT: {
                            integration: new LambdaIntegration(this.functions.putScriptLambda),
                            request: {
                              name: 'PutScriptInput',
                              description: 'Details about the new script',
                              schema: asInput(Script, ['name', 'source']),
                            },
                            response: {
                              name: 'PutScriptOutput',
                              description: 'The created/updated script',
                              schema: asEntity(Script),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '/validate': {
              // POST /data-product/scripts/validate
              POST: {
                integration: new LambdaIntegration(this.functions.validateScriptLambda),
                request: {
                  name: 'PostScriptValidateInput',
                  description: 'Validate user provided script for vulnerabilities',
                  schema: ScriptSourceValidationInput,
                },
                response: {
                  name: 'PostScriptValidateOutput',
                  description: 'Report containing the vulnerabilities of a script after scanning',
                  schema: ScriptSourceValidationOutput,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
            },
          },
        },
        '/dynamoDB': {
          paths: {
            '/table': {
              paths: {
                '/{tableArn}': {
                  paths: {
                    '/stream': {
                      GET: {
                        integration: new LambdaIntegration(this.functions.getTableStreamLambda),
                        response: {
                          name: 'getDataProductDynamoDBTableStream',
                          description: 'Handler for retrieving dynamodb table stream details',
                          schema: asEntity(TableStream),
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
