/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiError } from '../models'; // virtual dir reference to "client"
import { DefaultApi } from '../apis/DefaultApi'; // virtual dir reference to "client"
import type { Awaited } from '../../../../../@types/ts-utils';
import type { BaseAPI } from '../runtime';

type API = DefaultApi;

export type ApiOperationName = Exclude<keyof API, keyof BaseAPI>;

export type ApiOperation<O extends ApiOperationName> = API[O];

export type ApiOperationRequest<O extends ApiOperationName> = ApiOperation<O> extends (
  ...args: [infer Head, ...any]
) => any
  ? Head
  : never;

export type ApiOperationResponse<O extends ApiOperationName> = Awaited<ReturnType<ApiOperation<O>>>;

/**
 * All Api operations - includes both "Raw" and "Non-Raw" operations
 */
export type ApiOperations = {
  [I in ApiOperationName]: API[I];
};

/** Raw api operation name list */
export type ApiRawOperationName<T = keyof { [K in ApiOperationName as K extends `${string}Raw` ? K : never]: true }> =
  Exclude<T, never>;

/**
 * All Raw operations. Those which return the raw `ApiResponse` rather than parses JSON.
 */
export type ApiRawOperations = {
  [I in ApiRawOperationName]: ApiOperations[I];
};

export const API_OPERATION_KEYS: ApiOperationName[] = Object.keys(DefaultApi.prototype) as ApiOperationName[];

export const API_RAW_OPERATION_KEYS: ApiRawOperationName[] = Object.keys(DefaultApi.prototype).filter((k) => {
  return k.endsWith('Raw');
}) as ApiRawOperationName[];

/**
 * Api operations excluding "raw" variants
 */
export type ApiTransformedOperationName = Exclude<ApiOperationName, ApiRawOperationName>;

/**
 * Transformed Api operations; excludes Raw operations.
 */
export type ApiTransformedOperations = {
  [I in ApiTransformedOperationName]: ApiOperations[I];
};

export type ApiTransformedOperation<O extends ApiTransformedOperationName> = API[O];

export type ApiTransformedOperationRequest<O extends ApiTransformedOperationName> = ApiTransformedOperation<O> extends (
  ...args: [infer Head, ...any]
) => any
  ? Head
  : never;

export type ApiTransformedOperationResponse<O extends ApiTransformedOperationName> = Awaited<
  ReturnType<ApiTransformedOperation<O>>
>;

export type ApiPaginatedOperationName<
  T = keyof { [K in ApiTransformedOperationName as K extends `list${string}` ? K : never]: true },
> = Exclude<T, never>;

export type ApiPaginatedOperation<O extends ApiPaginatedOperationName> = API[O];

export type ApiPaginatedOperationRequest<O extends ApiPaginatedOperationName> = ApiPaginatedOperation<O> extends (
  ...args: [infer Head, ...any]
) => any
  ? Head
  : never;

export type ApiPaginatedOperationResponse<O extends ApiPaginatedOperationName> = Awaited<
  ReturnType<ApiPaginatedOperation<O>>
>;

export type TApiOperationFunction = (requestParameters: any, options?: RequestInit) => Promise<any>;

export enum OPERATION_ACTION {
  GET = 'get',
  LIST = 'list',
  PUT = 'put',
  POST = 'post',
  DELETE = 'delete',
}

export enum OPERATION_TYPE {
  QUERY = 'QUERY',
  MUTATION = 'MUTATION',
}

export const QUERY_ACTIONS = [OPERATION_ACTION.GET, OPERATION_ACTION.LIST] as const;

export type QUERY_ACTIONS = typeof QUERY_ACTIONS[number]; //NOSONAR export type

export const MUTATION_ACTIONS = [OPERATION_ACTION.DELETE, OPERATION_ACTION.PUT, OPERATION_ACTION.POST] as const;

export type MUTATION_ACTIONS = typeof MUTATION_ACTIONS[number]; //NOSONAR export type

export type InferOperationAction<Name extends ApiTransformedOperationName> = Name extends `get${Capitalize<string>}`
  ? OPERATION_ACTION.GET
  : Name extends `list${Capitalize<string>}`
  ? OPERATION_ACTION.LIST
  : Name extends `put${Capitalize<string>}`
  ? OPERATION_ACTION.PUT
  : Name extends `post${Capitalize<string>}`
  ? OPERATION_ACTION.POST
  : Name extends `delete${Capitalize<string>}`
  ? OPERATION_ACTION.DELETE
  : never;

export type InferOperationType<
  Name extends ApiTransformedOperationName,
  TAction = InferOperationAction<Name>,
> = TAction extends typeof MUTATION_ACTIONS[number] ? OPERATION_TYPE.MUTATION : OPERATION_TYPE.QUERY;

export const OPERATION_ACTIONS = Object.values(OPERATION_ACTION);

export const OPERATION_PATTERN = new RegExp(`^(?<action>${OPERATION_ACTIONS.join('|')})(?<base>.*)$`);

export const API_TRANSFORMED_OPERATION_KEYS = Object.keys(DefaultApi.prototype).filter((k) => {
  return k.match(OPERATION_PATTERN) && k.endsWith('Raw') === false;
}) as ApiTransformedOperationName[];

export function isApiError(error: ApiError | any): error is ApiError {
  return (error as ApiError).message != null;
}
