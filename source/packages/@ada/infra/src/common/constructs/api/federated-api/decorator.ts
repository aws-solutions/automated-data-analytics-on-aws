/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CommonQueryParameters } from '../common';
import { Construct } from 'constructs';
import {
  ExposedMethod,
  ExposedMethodOptions,
  ExposedMethodResponse,
  ExposedModel,
  ExposedRequestValidator,
  HTTP_METHOD,
  HTTP_METHODS,
  RequestProps,
  RequestResponseProps,
  ResponseProps,
  RestSchemaInput,
  RestSchemaOutput,
  StatusCodes,
} from './types';
import {
  IResource,
  IRestApi,
  Integration,
  JsonSchema,
  JsonSchemaVersion,
  LambdaIntegration,
  Resource,
  ResourceOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { OpenApiDefinition } from './openapi';
import { asPaginatedResponse, normalizeSchema } from '../utils';
import { capitalize, startCase } from 'lodash';
import { isPlural, plural } from 'pluralize';
import { pascalCase } from '@ada/cdk-core';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface IDecoratedRestApi extends IRestApi {
  readonly errorModel: ExposedModel;
  readonly requestValidator: ExposedRequestValidator;
  readonly openapi: OpenApiDefinition;

  createApiRef(scope: Construct, id: string): IDecoratedRestApi;
}

export interface IDecoratedResource
  extends Omit<Resource, 'addMethod' | 'addResource' | 'parentResource' | 'resourceForPath'> {
  api: IDecoratedRestApi;

  /**
   * Flag to indicate that resource is decorated; mostly for testing
   */
  decorated: true;

  parentResource: IDecoratedResource;

  /**
   * Defines a new method for this resource and automatically updates the api model based on request/response.
   *
   * @param httpMethod http method
   * @param integration integration for the method
   * @param options details about the request and response
   * @override
   */
  addMethod(httpMethod: HTTP_METHOD, integration?: Integration, options?: RequestResponseProps): ExposedMethod;

  /**
   * Maps schema definition mapping of resources and methods.
   *
   * @param schema Schema definition to apply to the resource.
   * @param defaultOptions Default options to apply to all methods.
   */
  addRoutes(schema: RestSchemaInput, defaultOptions?: RequestResponseProps): RestSchemaOutput;

  /**
   * Defines a new child resource where this resource is the parent.
   * Supports recursive paths separted by forward-slash (/), such as `addResource('foo/bar/baz')`
   *
   * @param path The path part for the child resource, or recursive path separated by forward-slash.
   * @param options Resource options.
   * @returns A Resource object. If recursive will return the last resource in the path.
   * @override
   */
  addResource(path: string, options?: ResourceOptions): IDecoratedResource;

  /**
   * Gets or create all resources leading up to the specified path.
   *
   * - Path may only start with "/" if this method is called on the root resource.
   * - All resources are created using default options.
   *
   * @override
   */
  resourceForPath(path: string, options?: ResourceOptions): IDecoratedResource;
}

export function DecoratedResource(api: IDecoratedRestApi, resource: Resource): IDecoratedResource {
  return new Proxy<IDecoratedResource>(resource as any, {
    getPrototypeOf: function (target) {
      return Reflect.getPrototypeOf(target);
    },
    /* eslint-disable sonarjs/cognitive-complexity */
    get: function (target, prop, receiver: IDecoratedResource) { //NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
      switch (prop as keyof IDecoratedResource) {
        case 'decorated': {
          return true as IDecoratedResource['decorated'];
        }
        case 'parentResource': {
          return resource.parentResource && DecoratedResource(api, resource.parentResource as unknown as Resource);
        }
        case 'addResource': {
          // wrap decendant resources with proxy
          const fn: IDecoratedResource['addResource'] = (_pathPart: string, options?: ResourceOptions) => {
            const pathParts: string[] = normalizePath(_pathPart).split('/');
            return DecoratedResource(
              api,
              pathParts.reduce((parent: Resource | IResource, pathPart: string) => {
                return parent.addResource(pathPart, options);
              }, resource),
            );
          };
          return fn;
        }
        case 'resourceForPath': {
          // decorated `addResource` supports recursive path creation already but adds options support as well
          return receiver.addResource as IDecoratedResource['resourceForPath'];
        }
        case 'addMethod': {
          // apply schema/validation/mapping/etc to the method
          const fn: IDecoratedResource['addMethod'] = (httpMethod, integration, options) => {
            const createResponseModel = !(integration instanceof LambdaIntegration);
            const method = new ExposedMethod(resource, httpMethod, {
              resource,
              httpMethod,
              integration,
              options: options && buildRequestResponse(api, resource, httpMethod, createResponseModel, options),
            });

            // update openapi definition
            api.openapi.addMethod(method);

            return method;
          };
          return fn;
        }
        case 'addRoutes': {
          // apply schema/validation/mapping/etc to the method
          const fn: IDecoratedResource['addRoutes'] = (schema, defaulMethodtOptions) => {
            const output: RestSchemaOutput = {};

            HTTP_METHODS.forEach((httpMethod: HTTP_METHOD) => {
              const definition = schema[httpMethod];
              if (definition != null) {
                const { integration, ...options } = definition;
                // add path to resource and map results to output
                output[httpMethod] = receiver.addMethod(httpMethod, integration, {
                  ...(defaulMethodtOptions || {}),
                  ...(options || {}),
                });
              }
            });

            // add child paths
            if (schema.paths != null) {
              output.paths = {};
              for (const [childPath, childSchema] of Object.entries(schema.paths)) {
                const childResource = receiver.addResource(childPath);
                output.paths[childPath] = childResource.addRoutes(childSchema as RestSchemaInput, defaulMethodtOptions);
              }
            }

            return output;
          };
          return fn;
        }
        default: {
          return Reflect.get(target, prop, receiver);
        }
      }
    },
    /* eslint-enable sonarjs/cognitive-complexity */
  });
}

function buildRequest(
  context: RequestResponseContext,
  { description, schema }: RequestProps,
): { [contentType: string]: ExposedModel } {
  const { operationName, resource } = context;
  const modelName = inferModelName(operationName, 'Request');

  const _schema = normalizeSchema(schema) as Mutable<JsonSchema>;

  _schema.id ??= `${operationName}Request`;

  return {
    'application/json': new ExposedModel(resource, modelName, {
      // do not add explicit `modelName` so model can be replaced
      restApi: resource.api,
      contentType: 'application/json',
      description,
      schema: {
        schema: JsonSchemaVersion.DRAFT4,
        title: modelName,
        ..._schema,
      },
    }),
  };
}

/**
 * Helper to define a response shape for an api method
 * @param name the name of the response model
 * @param description a description of the response model
 * @param schema defines the shape of the response body
 * @param errorStatusCodes error status codes that may be returned by the method
 * @param responseStatusCode the status code of the response (defaults to 200)
 * @param responseHeaders headers included in the response
 */
function buildResponse(
  context: RequestResponseContext,
  responses: ResponseProps[],
  createResponseModel: boolean,
): ExposedMethodResponse[] {
  const { api, resource, operationName } = context;

  return responses.reduce(
    (methodResponses: ExposedMethodResponse[], response: ResponseProps, index: number, responseProps) => {
      const { description, errorStatusCodes, responseHeaders, responseStatusCode = StatusCodes.OK } = response;
      let schema = normalizeSchema(response.schema) as Mutable<JsonSchema>;
      const modelAppendix = responseProps.length < 2 ? '' : String(index);
      const modelName = inferModelName(operationName, 'Response') + modelAppendix;

      schema.id ??= `${operationName}Response`;

      if (context.paginated && responseStatusCode === StatusCodes.OK) {
        schema = asPaginatedResponse(schema);
      }

      const modelParams = {
        // do not add explicit `modelName` so model can be replaced
        restApi: resource.api,
        contentType: 'application/json',
        description,
        schema: {
          schema: JsonSchemaVersion.DRAFT4,
          title: modelName,
          ...schema,
        },
      };

      // only create cdk instance of model if the response model is requried,
      // otherwise create a data structure instead of the CDK construct
      const responseModel = createResponseModel
        ? new ExposedModel(resource, modelName, modelParams)
        : ((<unknown>{ props: modelParams }) as ExposedModel);

      methodResponses.push({
        statusCode: String(responseStatusCode),
        responseModels: {
          'application/json': responseModel,
        },
        responseParameters:
          responseHeaders &&
          Object.keys(responseHeaders).reduce(
            (headers, header) => ({
              ...headers,
              [`method.response.header.${header}`]: responseHeaders[header],
            }),
            {},
          ),
      });

      methodResponses.push(
        ...errorStatusCodes.map((statusCode) => ({
          statusCode: statusCode.toString(),
          responseModels: {
            'application/json': api.errorModel,
          },
        })),
      );
      return methodResponses;
    },
    [],
  );
}

const PATH_PARAMETER_PATTERN = /^\{.*\}$/;

type MODEL_TYPE = 'Response' | 'Request';

function inferModelName(operationName: string, type: MODEL_TYPE): string {
  return operationName + type;
}

function inferOperationName(resource: Resource, httpMethod: HTTP_METHOD, paginated: boolean): string {
  const pathParts = resource.path.split('/').slice(1);

  let operation = pathParts.filter((part) => part.match(PATH_PARAMETER_PATTERN) == null).join('-');

  // Cast method to LIST if "paginated" GET operation
  const method = paginated && httpMethod === 'GET' ? 'LIST' : httpMethod;

  // Plural list operation name
  if (method === 'LIST' && !isPlural(operation)) {
    operation = plural(operation);
  }

  return pascalCase(method.toLowerCase() + '-' + operation);
}

function inferMethodDescription(
  description: string | undefined,
  operationName: string,
  _response: RequestResponseProps['response'],
): string {
  return description || capitalize(startCase(operationName).toLowerCase());
}

/**
 * Helper to generate apigateway method options with validation
 * @param request details about the request shape
 * @param response details about the response shape
 * @param requestParameters query parameters used in the request
 */
function buildRequestResponse(
  api: IDecoratedRestApi,
  resource: Resource,
  httpMethod: HTTP_METHOD,
  createResponseModel: boolean,
  { request, response, requestParameters, operationName, description, paginated = false }: RequestResponseProps,
): ExposedMethodOptions {
  if (operationName == null) {
    operationName = inferOperationName(resource, httpMethod, paginated);
  }
  const context: RequestResponseContext = {
    api,
    resource,
    httpMethod,
    operationName,
    description: inferMethodDescription(description, operationName, response),
    paginated,
  };

  if (context.paginated) {
    requestParameters = {
      ...(requestParameters || {}),
      ...CommonQueryParameters.Pagination,
    };
  }

  return {
    requestParameters,
    requestValidator: api.requestValidator,
    requestModels: request && buildRequest(context, request),
    methodResponses:
      response && buildResponse(context, Array.isArray(response) ? response : [response], createResponseModel),
    operationName: context.operationName,
    description: context.description,
  };
}

interface RequestResponseContext {
  readonly api: IDecoratedRestApi;
  readonly resource: Resource;
  readonly httpMethod: HTTP_METHOD;
  readonly operationName: string;
  readonly description: string;
  readonly paginated: boolean;
}

function normalizePath(path: string): string {
  if (path.startsWith('/')) path = path.substring(1); // remove root slash
  if (path.endsWith('/')) path = path.substring(0, path.length - 1); // remove trailing slash
  return path;
}
