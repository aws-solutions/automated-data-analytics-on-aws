/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as OpenAPI from './types';
import { Construct } from 'constructs';
import { ExposedMethod, ExposedModel } from '../types';
import { IDecoratedResource } from '../decorator';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { idModelName } from '../../utils';
import { isBoolean, isEmpty, isNil, omitBy, pick } from 'lodash';
import { solutionInfo } from '@ada/common';
import Debug from 'debug';
import stringifyNice from 'json-stringify-nice';

const debug = Debug('openapi');

export class OpenApiDefinition extends Construct {
  static readonly instances: OpenApiDefinition[] = [];

  private readonly document: OpenAPI.Document;

  get openapiSpec(): string {
    // using nice stringifier to have consintently sorted names
    return stringifyNice(this.document);
  }

  constructor(scope: Construct, id: string) {
    super(scope, id);

    OpenApiDefinition.instances.push(this);

    const { title, description, version } = solutionInfo();

    // https://spec.openapis.org/oas/latest.html
    this.document = {
      openapi: '3.0.1',
      info: {
        title: `${title} API`,
        description,
        version,
      },
      servers: [
        {
          url: 'https://{apigId}.execute-api.{region}.amazonaws.com/{stage}',
          variables: {
            apigId: {
              description: 'AWS API Gateway ID of deployed RestApi',
              default: 'APIG_ID',
            },
            region: {
              description: 'AWS region the api is deployed in',
              default: 'ap-southeast-1',
            },
            stage: {
              description: 'AWS API Gateway Stage',
              default: 'prod',
            },
          },
        },
      ],
      // https://spec.openapis.org/oas/latest.html#security-requirement-object
      // security: [{}],
      components: {
        schemas: {},
        securitySchemes: {
          // https://github.com/martzcodes/blog-cdk-openapi/blob/main/src/api.ts#L128
          authorizer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            // @ts-ignore`
            'x-amazon-apigateway-authtype': 'custom',
          },
        },
      } as OpenAPI.ComponentsObject,
      paths: {},
    };
  }

  private get paths(): OpenAPI.PathsObject {
    if (this.document.paths == null) {
      this.document.paths = {};
    }
    return this.document.paths;
  }

  private get schemas(): OpenAPI.Schemas {
    return this.document.components.schemas as OpenAPI.Schemas;
  }

  private getSchema(modelName: string): OpenAPI.SchemaValue {
    return this.schemas[modelName];
  }

  private getSchemaRef(modelName: string): OpenAPI.ReferenceObject | undefined {
    return {
      $ref: `#/components/schemas/${modelName}`,
    };
  }

  private addSchema(modelName: string, schema: OpenAPI.SchemaObject): OpenAPI.ReferenceObject {
    this.schemas[modelName] = schema;

    return this.getSchemaRef(modelName) as OpenAPI.ReferenceObject;
  }

  private getPathItem(path: string): OpenAPI.PathItemObject {
    if (this.paths[path] == null) {
      this.paths[path] = {};
    }
    return this.paths[path] as OpenAPI.PathItemObject;
  }

  addModel(model: ExposedModel): OpenAPI.ReferenceObject {
    let modelName: string;
    if (model.props.schema.id) {
      modelName = idModelName(model.props.schema.id);
    } else {
      modelName = model.props.schema.title as string;
    }
    const options = model.props;
    if (this.getSchema(modelName) != null) {
      debug(`addModel(${modelName}) called with existing model - just returning existing ref`);
      return this.getSchemaRef(modelName) as OpenAPI.ReferenceObject;
    }
    if (options == null) {
      return this.getSchemaRef(modelName) as OpenAPI.ReferenceObject;
    }

    const models: Record<string, OpenAPI.SchemaObject> = {};
    const schema = castSchemaObject(
      {
        description: options.description,
        ...options.schema,
        title: modelName,
      },
      models,
    );

    // add nested schema models
    Object.entries(models).forEach(([id, nestedModel]) => {
      this.addSchema(idModelName(id), nestedModel);
    });

    if ((schema as OpenAPI.ReferenceObject).$ref) {
      return schema as OpenAPI.ReferenceObject;
    } else {
      return this.addSchema(modelName, schema);
    }
  }

  addMethod(method: ExposedMethod): void {
    const { httpMethod } = method.props;
    const resource = method.resource as unknown as IDecoratedResource;
    const path = resource.path;
    const pathItem = this.getPathItem(path);

    const options = method.props.options || {};

    const operation = {
      operationId: method.props.options?.operationName,
      description: method.props.options?.description,
      requestBody: isEmpty(options.requestModels)
        ? undefined
        : {
            content: Object.entries(options.requestModels || {}).reduce((content, [contentType, requestModel]) => {
              return {
                ...content,
                [contentType]: {
                  schema: this.addModel(requestModel),
                } as OpenAPI.MediaTypeObject,
              };
            }, {} as OpenAPI.RequestBodyObjectContent),
            required: true,
          },
      responses: (options.methodResponses || []).reduce((responses, methodResponse) => {
        return {
          ...responses,
          [methodResponse.statusCode]: {
            description: `${methodResponse.statusCode} response`,
            content: Object.entries(methodResponse.responseModels || {}).reduce(
              (content, [contentType, responseModel]) => {
                return {
                  ...content,
                  [contentType]: {
                    schema: this.addModel(responseModel),
                  } as OpenAPI.MediaTypeObject,
                };
              },
              {} as OpenAPI.ResponseObjectContent,
            ),
          } as OpenAPI.ResponseObject,
        };
      }, {} as OpenAPI.ResponsesObject),
      parameters: (method.parameters || []).map((param) => {
        let inProp = param.in || 'query';
        // convert AWS APIG mapping key to openapi - https://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html
        if (inProp === 'querystring') {
          inProp = 'query';
        }
        return {
          ...param,
          in: inProp,
        };
      }),
    } as OpenAPI.OperationObject;

    // @ts-ignore
    pathItem[castHttpMethod(httpMethod)] = operation;
  }
}

const DEFINITION_REF_PATTERN = /^#\/definitions\/(\w+)$/;

function castHttpMethod(httpMethod: string): OpenAPI.HttpMethods {
  return httpMethod.toLowerCase() as OpenAPI.HttpMethods;
}

// models will be extracted into "models" object passed in
/* eslint-disable sonarjs/cognitive-complexity */
function castSchemaObject( //NOSONAR (S3776:Cognitive Complexity) - won't fix
  schema: JsonSchema | JsonSchema[],
  models: Record<string, OpenAPI.SchemaObject>,
): OpenAPI.SchemaObject | OpenAPI.ReferenceObject {
  if (Array.isArray(schema)) {
    console.warn(schema);
    throw new Error('Currently OpenApiDefinition does not support array schemas');
  }

  // exit early for ref
  if (schema.ref) {
    // ensure ref in JsonSchema is absolute referenced model identitier
    if (schema.ref.startsWith(__dirname.split('/').slice(0, 2).join('/'))) {
      console.error(schema.ref, schema);
      throw new Error(`JsonSchema ref for openapi mapping must be wrapped in \`asRef()\`: ${schema.ref} is invalid`);
    }

    const [, modelName] = schema.ref.match(DEFINITION_REF_PATTERN) || [];
    if (modelName == null) {
      throw new Error(`Failed to extract model name from ref: ${schema.ref}`);
    }

    return {
      $ref: `#/components/schemas/${modelName}`,
      description: schema.description,
    } as OpenAPI.ReferenceObject;
  }

  // https://spec.openapis.org/oas/v3.0.1.html#properties
  // The following properties are taken directly from the JSON Schema definition and follow the same specifications:
  const directSchema = pick(schema, [
    'title',
    'multipleOf',
    'maximum',
    'exclusiveMaximum',
    'minimum',
    'exclusiveMinimum',
    'maxLength',
    'minLength',
    'pattern', // (This string SHOULD be a valid regular expression, according to the ECMA 262 regular expression dialect)
    'maxItems',
    'minItems',
    'uniqueItems',
    'maxProperties',
    'minProperties',
    'required',
    'enum',
    // forced
    'description',
  ] as Extract<keyof OpenAPI.SchemaObject, keyof OpenAPI.SchemaObject>[]);

  // The following properties are taken from the JSON Schema definition but their definitions were adjusted to the OpenAPI Specification.
  const adjustedSchema = pick(schema, [
    'type', // Value MUST be a string.Multiple types via an array are not supported.
    'allOf', // Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.
    'oneOf', // Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.
    'anyOf', // Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.
    'not', // Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.
    'items', // Value MUST be an object and not an array.Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.items MUST be present if the type is array.
    'properties', // Property definitions MUST be a Schema Object and not a standard JSON Schema(inline or referenced).
    'additionalProperties', // Value can be boolean or object.Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema.
    // 'description', // CommonMark syntax MAY be used for rich text representation.
    'format', // See Data Type Formats for further details.While relying on JSON Schema’s defined formats, the OAS offers a few additional predefined formats.
    'default', // The default value represents what would be assumed by the consumer of the input as the value of the schema if one is not provided.Unlike JSON Schema, the value MUST conform to the defined type for the Schema Object defined at the same level.For example, if type is string, then default can be "foo" but cannot be 1.
  ] as Extract<keyof OpenAPI.SchemaObject, keyof OpenAPI.SchemaObject>[]);

  // convert all nested dependencies to models
  const dependencies: JsonSchema['dependencies'] = schema.dependencies;
  if (dependencies) {
    Object.entries(dependencies).forEach(([_, dependency]) => {
      if (Array.isArray(dependency))
        throw new Error(`JsonSchema dependencies must be full schema object not string: ${dependency}`);
      // no need to track reference to dependencys as they will get added to "models" mapping already during cast
      castSchemaObject(dependency, models);
    });
  }
  // convert all nested definitions to models
  const definitions: JsonSchema['definitions'] = schema.definitions;
  if (definitions) {
    Object.entries(definitions).forEach(([_, definition]) => {
      if (Array.isArray(definition))
        throw new Error(`JsonSchema definitions must be full schema object not string: ${definition}`);
      // no need to track reference to definitions as they will get added to "models" mapping already during cast
      castSchemaObject(definition, models);
    });
  }

  let additionalProperties = adjustedSchema.additionalProperties;
  if (schema.patternProperties && '^.*$' in schema.patternProperties) {
    if (additionalProperties && !isBoolean(additionalProperties)) {
      throw new Error('OpenApiDefinition schema `patternProperties` and `additionalProperties` are mutually exclusive');
    }
    additionalProperties = schema.patternProperties['^.*$'];
  }

  const result: OpenAPI.SchemaObject = omitBy(
    {
      ...directSchema,
      ...((castSchemaType(schema.type, schema.items) || {}) as any),
      properties: castScemaProperties(adjustedSchema.properties, models),
      items: adjustedSchema.items && castSchemaObject(adjustedSchema.items, models),
      additionalProperties: castAdditionalProperties(additionalProperties, models),
      allOf: adjustedSchema.allOf && castOf(adjustedSchema.allOf, models),
      oneOf: adjustedSchema.oneOf && castOf(adjustedSchema.oneOf, models),
      anyOf: adjustedSchema.anyOf && castOf(adjustedSchema.anyOf, models),
      not: adjustedSchema.not && castSchemaObject(adjustedSchema.not, models),
      default: adjustedSchema.default,
    },
    isNil,
  );

  const resultKeys = Object.keys(result);
  Object.keys(adjustedSchema).forEach((key) => {
    if (!resultKeys.includes(key)) {
      throw new Error(`OpenApi schema mapping is missing "${key}" from casting of SchemaObject"`);
    }
  });

  // check if our api definition defines "id" to indicate reusable schema
  if (schema.id) {
    const ref = normalizeIdToRef(schema.id);
    models[schema.id] = result;

    return {
      $ref: ref,
      description: result.description,
    } as OpenAPI.ReferenceObject;
  }

  return result;
}
/* eslint-enable sonarjs/cognitive-complexity */

function castSchemaType(
  type: JsonSchemaType | JsonSchemaType[] | undefined,
  items: JsonSchema['items'],
  models: Record<string, OpenAPI.SchemaObject> = {},
): { type?: OpenAPI.SchemaObjectType[]; items?: OpenAPI.ArraySchemaObjectItems } | undefined {
  if (Array.isArray(type) || type === JsonSchemaType.ARRAY) {
    return {
      type: 'array' as any,
      items: items && castSchemaObject(items, models),
    };
  }

  return {
    type: (type || 'object') as any,
  };
}

function castScemaProperties(
  properties: JsonSchema['properties'] | undefined,
  models: Record<string, OpenAPI.SchemaObject>,
): OpenAPI.SchemaObjectProperties | undefined {
  if (properties == null) return undefined;

  return Object.entries(properties).reduce((_properties, [name, property]) => {
    return {
      ..._properties,
      // NOTE: improve this by using schema.type https://github.com/swagger-api/swagger-codegen/issues/6470#issuecomment-329965735
      [name]: castSchemaObject(property, models),
    };
  }, {} as OpenAPI.SchemaObjectProperties);
}

function castAdditionalProperties(
  value: JsonSchema['additionalProperties'] | undefined,
  models: Record<string, OpenAPI.SchemaObject>,
): OpenAPI.SchemaObject['additionalProperties'] | undefined {
  if (value == null || isBoolean(value)) return value;

  return castSchemaObject(value, models);
}

type TJSAllOf = JsonSchema['allOf'];
type TJSOneOf = JsonSchema['oneOf'];
type TJSAnyOf = JsonSchema['anyOf'];
type JsonSchemaOf = TJSAllOf | TJSOneOf | TJSAnyOf;
type TOpenAPIAllOf = OpenAPI.SchemaObject['allOf'];
type TOpenAPIOneOf = OpenAPI.SchemaObject['oneOf'];
type TOpenAPIAnyOf = OpenAPI.SchemaObject['anyOf'];
type CastOfReturn<T extends JsonSchemaOf> = T extends TJSAllOf
  ? TOpenAPIAllOf
  : T extends TJSOneOf
  ? TOpenAPIOneOf
  : T extends TJSAnyOf
  ? TOpenAPIAnyOf
  : never;

function castOf<T extends JsonSchemaOf>(
  values: T | undefined | null,
  models: Record<string, OpenAPI.SchemaObject>,
): CastOfReturn<T> | undefined {
  if (values == null) return;

  return values.map((value) => castSchemaObject(value, models)) as any;
}

function normalizeIdToRef(id: string): string {
  return `#/components/schemas/${idModelName(id)}`;
}
