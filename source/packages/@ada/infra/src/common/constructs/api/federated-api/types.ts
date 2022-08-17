/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as OpenAPI from './openapi/types';
import { Construct } from 'constructs';
import {
  Integration,
  JsonSchema,
  Method,
  MethodOptions,
  MethodProps,
  MethodResponse,
  Model,
  ModelProps,
  RequestValidator,
  RequestValidatorProps,
} from 'aws-cdk-lib/aws-apigateway';
import { JsonSchemaMapper } from '@ada/common';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { isEmpty } from 'lodash';

export { StatusCodes } from 'http-status-codes/build/cjs';

export type HTTP_METHOD = 'POST' | 'GET' | 'PUT' | 'DELETE';

export const HTTP_METHODS: HTTP_METHOD[] = ['POST', 'GET', 'PUT', 'DELETE'];

const SchemaPropsWithUserDefinedChildren = JsonSchemaMapper.SchemaPropsWithUserDefinedChildren;

type JsonSchemaDefinitions = Required<JsonSchema>['definitions'];

function toApigJsonSchema(schema: JsonSchema): JsonSchema {
  const definitions: JsonSchemaDefinitions = {};
  const newSchema = _toApigJsonSchema(schema, definitions);
  if (!isEmpty(definitions)) {
    return {
      ...newSchema,
      definitions,
    };
  }
  return newSchema;
}
function _toApigJsonSchema(schema: JsonSchema, definitions: JsonSchemaDefinitions, preserve = false): any {
  if (schema == null || typeof schema !== 'object') {
    return schema;
  }
  if (Array.isArray(schema)) {
    return schema.map((entry) => _toApigJsonSchema(entry, definitions));
  }
  return Object.assign(
    {},
    ...Object.entries(schema).map(([key, value]) => {
      if (!preserve && key === 'id') {
        return {}; // remove id
      } else if (!preserve && key === 'definitions') {
        // Hoist all "definitions" to the root
        // We have already guarenteed uniqueness with filename base id check earlier
        const defs: JsonSchemaDefinitions = _toApigJsonSchema(value, definitions, true);
        Object.entries(defs).forEach(([defKey, definition]) => {
          definitions[definition.id || defKey] = definition;
        });
        return {}; // remove "definitions" from sub-schema
      } else {
        const newValue = _toApigJsonSchema(value, definitions, SchemaPropsWithUserDefinedChildren[key]);
        return { [key]: newValue };
      }
    }),
  );
}

export class ExposedModel extends Model {
  constructor(scope: Construct, id: string, public readonly props: ModelProps) {
    super(scope, id, {
      ...props,
      schema: toApigJsonSchema(props.schema),
    });
  }
}

export interface ExposedMethodProps extends Omit<MethodProps, 'options'> {
  readonly options?: ExposedMethodOptions;
}

const PATH_PARAMS_REGEX = /\{([^}]*)\}/g; //NOSONAR (S5852:Super-Linear Regex) - non user-controlled
const REQUEST_PARAMETER_NAME = /^method\.request\.(\w+)\.(\w+)$/;

type UniversalParameterObject = OpenAPI.ParameterObject & { qualifiedName: string };

/* eslint-disable sonarjs/cognitive-complexity */
export class ExposedMethod extends Method {
  static interpolateRequestParameters( //NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
    path: string,
    requestParameters?: RequestParameters,
  ): [MethodOptions['requestParameters'], UniversalParameterObject[] | undefined] {
    const pathParametersNames = (path.match(PATH_PARAMS_REGEX) || []).map((match) => match.replace(/\{(.*)\}/, '$1')); //NOSONAR (S5852:Super-Linear Regex) - non user-controlled
    // inject "path" parameters into requestParameters
    requestParameters = pathParametersNames.reduce((_requestParameters, pathParamName) => {
      const reqParam = Object.entries(_requestParameters).find(([key, value]) => {
        if (typeof value === 'boolean') value = { required: value };
        const [, locationRO = value.in, name = key] = key.match(REQUEST_PARAMETER_NAME) || [];
        let location = locationRO;
        // ensure location is AWS spec and not openapi
        if (location === 'query') {
          location = 'querystring';
        }
        if (name === pathParamName) {
          if (location === 'path' || location == null) return true;
          throw new Error(`Method "${name} (${pathParamName})" ${path} has conflicting parameter in path and `);
        }
        return false;
      });

      if (reqParam) {
        const [key, value] = reqParam;
        return {
          ..._requestParameters,
          [key]: {
            name: pathParamName,
            in: 'path',
            required: true,
            ...(typeof value === 'boolean' ? { required: value } : value),
            qualifiedName: `method.request.path.${key}`,
          },
        };
      } else {
        const qualifiedName = `method.request.path.${pathParamName}`;
        return {
          ..._requestParameters,
          [qualifiedName]: {
            name: pathParamName,
            in: 'path',
            required: true,
            qualifiedName,
          },
        };
      }
    }, requestParameters || {});

    if (isEmpty(requestParameters)) return [undefined, undefined];

    const parameters = Object.entries(requestParameters).reduce((_parameters, [key, value]) => {
      // APIG: A source must match the format method.request.location.name, where the location is querystring, path, or header, and name is a valid, unique parameter name.
      // https://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html
      if (typeof value === 'boolean') value = { required: value };
      const [, locationRO = value.in || 'querystring', name = key] = key.match(REQUEST_PARAMETER_NAME) || [];
      let location = locationRO;
      // ensure location is AWS spec and not openapi
      if (location === 'query') {
        location = 'querystring';
      }
      const qualifiedName = `method.request.${location}.${name}`;

      const parameter: UniversalParameterObject = {
        name,
        in: location,
        qualifiedName,
        schema: { type: 'string' },
        ...value,
      };

      return [..._parameters, parameter];
    }, [] as UniversalParameterObject[]);

    const interpolatedRequestParameters = parameters.reduce((_requestParameters, { qualifiedName, required }) => {
      return {
        ..._requestParameters,
        [qualifiedName]: required || false,
      };
    }, {} as Required<MethodOptions>['requestParameters']);

    // cleanup additional non-spec props from openapi parameters (fails generator client otherwise)
    parameters.forEach((parameter: any) => {
      delete parameter.qualifiedName;
    });

    return [interpolatedRequestParameters, parameters];
  }

  readonly props: ExposedMethodProps;
  readonly parameters?: OpenAPI.ParameterObject[];

  constructor(scope: Construct, id: string, props: ExposedMethodProps) {
    const [requestParameters, parameters] = ExposedMethod.interpolateRequestParameters(
      props.resource.path,
      props.options?.requestParameters,
    );
    super(scope, id, {
      ...props,
      options: {
        ...(props.options || {}),
        requestParameters,
      },
    });

    this.props = props;
    this.parameters = parameters;
  }
}

/* eslint-enable sonarjs/cognitive-complexity */
export class ExposedRequestValidator extends RequestValidator {
  constructor(scope: Construct, id: string, public readonly props: RequestValidatorProps) {
    super(scope, id, props);
  }
}

export interface ExposedMethodResponse extends MethodResponse {
  readonly responseModels?: {
    [contentType: string]: ExposedModel;
  };
}

export interface ExposedMethodOptions extends Omit<MethodOptions, 'requestParameters'> {
  readonly methodResponses?: ExposedMethodResponse[];
  readonly requestModels?: {
    [param: string]: ExposedModel;
  };
  readonly requestValidator?: ExposedRequestValidator;
  readonly requestParameters?: RequestParameters;
  readonly description?: string;
}

export interface RequestProps {
  /**
   * @deprecated Model names are autmatically infered based on method path and type.
   */
  readonly name: string;
  readonly description: string;
  readonly schema: JsonSchema;
}

export interface ResponseProps extends RequestProps {
  readonly errorStatusCodes: StatusCodes[];
  readonly responseStatusCode?: StatusCodes;
  readonly responseHeaders?: { [header: string]: boolean };
}

export interface RequestResponseProps {
  readonly paginated?: boolean;
  readonly operationName?: string;
  readonly description?: string;
  readonly request?: RequestProps;
  readonly response?: ResponseProps | ResponseProps[];
  readonly requestParameters?: RequestParameters;
}

export interface RestMethodOptions extends RequestResponseProps {
  readonly integration?: Integration;
}

export interface RestSchema<T extends RestMethodOptions | Method> {
  POST?: T;
  GET?: T;
  PUT?: T;
  DELETE?: T;
  paths?: {
    [path: string]: RestSchema<T>;
  };
}

export type RestSchemaInput = RestSchema<RestMethodOptions>;

export type RestSchemaOutput = RestSchema<Method>;

export interface RequestParameters {
  [param: string]: boolean | Partial<OpenAPI.ParameterObject>;
}
