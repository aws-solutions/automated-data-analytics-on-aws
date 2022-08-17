/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from '@ada/api';
import {
  ApiTransformedOperationName,
  ApiTransformedOperationRequest,
  ApiTransformedOperationResponse,
  EntityIdentifier,
  OPERATION_TYPE,
  OperationMeta,
  getEntityKeyFromParam,
  getOperationMeta,
} from '@ada/api/client/types';
import { CallingUser } from '@ada/common';
import { ILockClient, LockClient } from '../components/entity/locks/client';
import { IRelationshipClient, RelationshipClient } from '../components/entity/relationships/client';
import { Logger } from '../../../common/constructs/lambda/lambda-logger';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { UnionToTuple } from '../../../../../../../@types/ts-utils';
import { get } from 'lodash';
import { getCallerDetails } from './api-request';
import ShortUniqueId from 'short-unique-id';
import VError from 'verror';

const shortuuid = new ShortUniqueId({ length: 10 });

function generateErrorId(): string {
  return shortuuid();
}

type ResponseError = VError | ApiError | Error;

const CORS_HEADERS = {
  // APIG lambda handlers don't have website/api domain to restrict this further, but APIG OPTION for each route
  // already handles more restrictive CORS during pre-flight
  'Access-Control-Allow-Origin': '*', //NOSONAR (typescript:S5122) - CORS is handled by APIG OPTION to restrict origin
  'Access-Control-Allow-Headers': '*', //NOSONAR (typescript:S5122) - CORS is handled by APIG OPTION to restrict headers
};

const log = Logger.getLogger({ tags: ['ApiResponse'] });

type ApiGatewayRawLambdaHandler = (event: APIGatewayProxyEvent, context: any) => Promise<APIGatewayProxyResult>;

type ResponseHeaders = {
  [header: string]: boolean | number | string;
};

/**
 * Helper methods for api responses
 */
export class ApiResponse<T extends unknown | void> {
  private readonly statusCode: StatusCodes;
  private readonly body?: T;
  private readonly headers?: ResponseHeaders;

  private constructor(statusCode: StatusCodes, body?: T, headers?: ResponseHeaders) {
    this.statusCode = statusCode;
    this.body = body;
    this.headers = headers;
  }

  public asApiGatewayResult = (): APIGatewayProxyResult => ({
    statusCode: this.statusCode,
    body: this.body ? JSON.stringify(this.body) : '',
    headers: {
      ...CORS_HEADERS,
      ...this.headers,
    },
  });

  /**
   * Construct a response with the given status code and custom headers
   * @param statusCode HTTP status code
   * @param body response body will be returned as json
   * @param headers list of headers to be sent to the client
   */
  public static respondWithHeaders = <TBody extends any | void>(
    statusCode: StatusCodes,
    body?: TBody,
    headers?: {
      [header: string]: boolean | number | string;
    },
  ): ApiResponse<TBody> => new ApiResponse<TBody>(statusCode, body, headers);

  /**
   * Construct a response with the given status code
   * @param statusCode HTTP status code
   * @param body response body will be returned as json
   */
  public static respond = <TBody extends any | void>(statusCode: StatusCodes, body: TBody): ApiResponse<TBody> => {
    if (statusCode >= 300) {
      const errorId = generateErrorId();

      if (statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
        // remapped 500 error to 409 error to prevent client from discovering potential vulnerabilities.
        const error: ApiError = body as unknown as ApiError;
        const responseError: ResponseError = new Error('Failed to service request');
        log.error(`InternalServerError: (${errorId}) ${error.message || String(error)}`, {
          errorId,
          actualStatusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          responseStatusCode: StatusCodes.CONFLICT,
          reason: `Internal server error security obfuscation remapped to CONFLICT:${StatusCodes.CONFLICT} in reponse to prevent leaking vulnerabilities.`,
          cause: error,
          responseError,
          body,
        });

        return ApiResponse.respondWithHeaders(StatusCodes.CONFLICT, {
          name: 'Error',
          message: 'Failed to service request',
          details: errorId,
          errorId,
        } as TBody);
      }

      if (typeof body === 'object') {
        // add errorId to non-successful rsponses for traceability
        Object.assign(body as any, { errorId });
      }

      // Log all non-ok responses when debugging is enabled
      log.debug(`Response status code ${statusCode}`, { body, errorId });
    }

    return ApiResponse.respondWithHeaders(statusCode, body);
  };

  public static errorRespond = (statusCode: StatusCodes, error: ResponseError): ApiResponse<ApiError> => {
    const name: string = error.name || 'Error';
    const message: string = error.message;
    const cause: string | undefined =
      'cause' in error
        ? get(error, 'cause.message') || String(error.message) || VError.cause(error as Error)?.message
        : undefined;
    const details: string | undefined =
      'details' in error ? get(error, 'details') || get(error, 'info.details') : undefined;
    const body: ApiError = { name, message, cause, details };

    return ApiResponse.respond(statusCode, body);
  };

  /**
   * Construct a successful response
   * @param body response body will be returned as json
   */
  public static success = <TBody extends any | void>(body: TBody): ApiResponse<TBody> =>
    ApiResponse.respond(StatusCodes.OK, body);

  /**
   * Construct a bad request response
   * @param error details about the issue with the request
   */
  public static badRequest = (error: ResponseError): ApiResponse<ApiError> =>
    ApiResponse.errorRespond(StatusCodes.BAD_REQUEST, error);

  /**
   * Construct a not found response
   * @param error details about the issue with the request
   */
  public static notFound = (error: ResponseError): ApiResponse<ApiError> =>
    ApiResponse.errorRespond(StatusCodes.NOT_FOUND, error);

  /**
   * Construct a forbidden response
   * @param error details about the issue with the request
   */
  public static forbidden = (error: ResponseError): ApiResponse<ApiError> =>
    ApiResponse.errorRespond(StatusCodes.FORBIDDEN, error);

  /**
   * Construct a internal server error response
   * @param error details about the issue with the request
   */
  public static internalServerError = (error: ResponseError): ApiResponse<ApiError> => {
    return ApiResponse.errorRespond(StatusCodes.INTERNAL_SERVER_ERROR, error);
  };
}

export const isApiClientErrorResponse = (e: any) => 'json' in e && 'status' in e;

export interface ApiLambdaHandlerContext {
  readonly lockClient: ILockClient;
  readonly relationshipClient: IRelationshipClient;
  log: Logger;
}

// The request object for a particular api operation
type ORequest<OName extends ApiTransformedOperationName> = ApiTransformedOperationRequest<OName>;
// The response object for a particular api operation
type OResponse<OName extends ApiTransformedOperationName> = ApiTransformedOperationResponse<OName>;
// Define the types of the top level request payload that aren't in the body - all primitives or primitive arrays
type Primitive = string | number | boolean;
type NonBodyTypes = Primitive | Primitive[] | undefined;
// Extract all body types from the request (there should only be one)
type OBody<OName extends ApiTransformedOperationName> = {
  [P in keyof ORequest<OName> as ORequest<OName>[P] extends NonBodyTypes ? never : P]: ORequest<OName>[P];
};
// The non body type parameters of the request are the request parameters (combined path parameters, query parameters)
type ORequestParametersRaw<OName extends ApiTransformedOperationName> = Omit<ORequest<OName>, keyof OBody<OName>>;
// Path and query parameters come from apigateway as a string/string[], so we create a type with each request parameter key as it will arrive in the event
export type ORequestParameters<OName extends ApiTransformedOperationName> = {
  [P in keyof ORequestParametersRaw<OName> as ORequestParametersRaw<OName>[P] extends any[] | undefined
    ? never
    : P]: string;
};

export type ORequestArrayParameters<OName extends ApiTransformedOperationName> = {
  [P in keyof ORequestParametersRaw<OName> as ORequestParametersRaw<OName>[P] extends any[] | undefined
    ? P
    : never]: string[];
};

// Take the first (and only!) property of the filtered body request parameters
type OBodyProp<OName extends ApiTransformedOperationName> = UnionToTuple<keyof OBody<OName>>[0];
// Take the value (not caring about the key) of the body property
export type OBodyValue<OName extends ApiTransformedOperationName> = OBodyProp<OName> extends keyof OBody<OName>
  ? OBody<OName>[OBodyProp<OName>]
  : never;

export type LambdaRequestParameters<OName extends ApiTransformedOperationName> = {
  requestParameters: ORequestParameters<OName>;
  requestArrayParameters: ORequestArrayParameters<OName>;
  body: OBodyValue<OName>;
};

/**
 * Type for lambda handler functions with strongly typed inputs and outputs
 */
export type ApiGatewayLambdaHandler<OName extends ApiTransformedOperationName, TOResponse extends any | void> = (
  requestParameters: LambdaRequestParameters<OName>,
  callingUser: CallingUser,
  event: APIGatewayProxyEvent,
  handlerContext: ApiLambdaHandlerContext,
) => Promise<ApiResponse<TOResponse | ApiError>>;

// Standard apigateway request parameters (query parameters or path parameters, multi or single value)
type ApiGatewayRequestParameters = { [key: string]: string | string[] | undefined };

/**
 * URI decode for a string or array of strings
 */
const uriDecode = (value: string | string[]): string | string[] =>
  typeof value === 'string' ? decodeURIComponent(value) : value.map((v) => decodeURIComponent(v));

/**
 * URI decodes apigateway request parameters (query or path parameters)
 */
const decodeRequestParameters = (parameters: ApiGatewayRequestParameters): ApiGatewayRequestParameters =>
  Object.fromEntries(Object.entries(parameters || {}).map(([key, value]) => [key, value ? uriDecode(value) : value]));

type GetPrimaryLockedEntityFunction<OName extends ApiTransformedOperationName> = (
  meta: OperationMeta<OName>,
  requestParameters: LambdaRequestParameters<OName>,
) => EntityIdentifier | undefined;

// For most entities we can automatically infer the entity identifier
const defaultGetPrimaryEntityToLock = <OName extends ApiTransformedOperationName>(
  meta: OperationMeta<OName>,
  { requestParameters }: LambdaRequestParameters<OName>,
) => ({
  type: meta.key,
  identifierParts: getEntityKeyFromParam(meta.entityKey as string[], requestParameters),
});

/**
 * Methods for typed api lambda handlers
 */
export class ApiLambdaHandler {
  /**
   * Create a lambda handler for an api gateway proxy event with strongly typed input and output for a particular
   * api operation
   * @param operationName the name of the operation
   * @param handler the handler function to serve the request
   * @param getPrimaryEntityToLock an optional method to return the primary entity to acquire a lock on (when the
   * operation is a mutation)
   */
  public static for =
    <OName extends ApiTransformedOperationName>(
      operationName: OName,
      handler: ApiGatewayLambdaHandler<OName, OResponse<OName>>,
      getPrimaryEntityToLock: GetPrimaryLockedEntityFunction<OName> = defaultGetPrimaryEntityToLock,
    ): ApiGatewayRawLambdaHandler =>
    /* eslint-disable sonarjs/cognitive-complexity */
    async (event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> => { //NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
      // create logger

      const handlerLog = Logger.getLogger({
        lambda: {
          event,
          context,
        },
      });

      // The request parameters are all of the path parameters and query parameters.
      // We url-decode these as they are encoded in the client
      handlerLog.info(`Starting request for ${operationName}`);
      const requestParameters = decodeRequestParameters({
        ...(event.pathParameters || {}),
        ...(event.queryStringParameters || {}),
      }) as ORequestParameters<OName>;

      const requestArrayParameters = decodeRequestParameters({
        ...(event.multiValueQueryStringParameters || {}),
      }) as ORequestArrayParameters<OName>;

      const lockClient = LockClient.getInstance(operationName);

      const relationshipClient = RelationshipClient.getInstance();
      const handlerContext: ApiLambdaHandlerContext = {
        lockClient,
        relationshipClient,
        log: handlerLog,
      };

      let body: OBodyValue<OName>;
      try {
        body = JSON.parse(event.body || '{}') as OBodyValue<OName>;
      } catch (e: any) {
        return ApiResponse.badRequest(
          new VError(
            {
              name: 'JsonParsingError',
              cause: e,
            },
            `Unable to parse request body as json`,
          ),
        ).asApiGatewayResult();
      }

      const input: LambdaRequestParameters<OName> = {
        requestParameters,
        requestArrayParameters,
        body,
      };

      const meta = getOperationMeta(operationName);
      handlerLog.debug('Operation meta', meta);

      if (meta.entityKey && meta.type === OPERATION_TYPE.MUTATION) {
        const primaryEntity = getPrimaryEntityToLock(meta, input);
        if (primaryEntity) {
          await lockClient.acquire(primaryEntity);
        } else {
          handlerLog.info('No lock will be acquired for operation', { operationName });
        }
      }

      let response: ApiResponse<OResponse<OName> | ApiError>;
      try {
        // Call the lambda handler with the typed request parameters and body
        response = await handler(input, getCallerDetails(event), event, handlerContext);
      } catch (e: any) {
        // Handle any errors thrown by the handler
        if (e instanceof Error || 'message' in e) {
          handlerLog.warn(`Error caught: ${e.message}`, { error: e });
          response = ApiResponse.badRequest(e);
        } else if (isApiClientErrorResponse(e)) {
          const error = await e.json();
          handlerLog.warn(`Error caught: ${e.message}`, { error });
          // Proxy the status code and error from a failed api client request
          response = ApiResponse.respond(e.status, error);
        } else {
          handlerLog.warn(`Error caught: ${String(e)}`, { error: e });
          response = ApiResponse.internalServerError(
            new VError({ name: 'UnexpectedServerError', cause: e }, 'An unexpected error occurred'),
          );
        }
      } finally {
        // Release any held locks before we exit
        await lockClient.releaseAll();
      }
      return response.asApiGatewayResult();
    };
  /* eslint-enable sonarjs/cognitive-complexity */

  /**
   * Specify this as the 'getPrimaryEntityToLock' method if you would like to disable locking for an operation
   */
  public static doNotLockPrimaryEntity = () => undefined;
}
