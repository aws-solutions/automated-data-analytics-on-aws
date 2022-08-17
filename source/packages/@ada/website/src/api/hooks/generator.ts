/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as pluralize from 'pluralize';
import {
  API_TRANSFORMED_OPERATION_KEYS,
  ApiOperationResponse,
  ApiPaginatedOperationName,
  ApiPaginatedOperationRequest,
  ApiPaginatedOperationResponse,
  ApiTransformedOperation,
  ApiTransformedOperationName,
  ApiTransformedOperationRequest,
  ApiTransformedOperationResponse,
  ApiTransformedOperations,
  EntityTypes,
  GetOperationEntity,
  GetOperationKey,
  InferOperationAction,
  IsEntityOperation,
  MUTATION_ACTIONS,
  NonEntityOperationKeys,
  OPERATION_ACTION,
  OperationEntityName,
  OperationMeta,
  QUERY_ACTIONS,
  getEntityKeyFromParam,
  getOperationAction,
  getOperationMeta,
} from '@ada/api-client/types';
import {
  ApiError,
  GetGovernancePolicyAttributeValuesGroupRequest,
  GetGovernancePolicyAttributesGroupRequest,
  PaginatedResponse,
} from '@ada/api-client';
import { ENV_STORYBOOK, featureFlag } from '$config';
import {
  InfiniteData,
  QueryClient,
  QueryKey,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from 'react-query';
import { OperationAccess, useOperationAccess } from './permissions';
import { Pluralize } from '$ts-utils';
import {
  capitalize,
  cloneDeep,
  compact,
  has,
  isEmpty,
  isEqual,
  isNil,
  isObject,
  last,
  merge,
  omit,
  omitBy,
  pick,
} from 'lodash';
import { isDataEqual } from '$common/utils/misc';
import { useStatefulRef } from '$common/hooks/use-stateful-ref';
import EventEmitter from 'eventemitter3';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* eslint-plugin-disable sonarjs */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types */

interface PagintationParams {
  nextToken?: string;
  pageSize?: number;
  limit?: number;
}

interface EventTypes {
  'entity.SET': [type: string, id: string | string[], entity: any];
  'entity.REMOVED': [type: string, id: string | string[], entity: any];
}
export type EntityCacheEventEmitter = EventEmitter<EventTypes>;

export const EntityCacheEventEmitter = new EventEmitter<EventTypes>();

export const ENABLE_HOT_UPDATES = !ENV_STORYBOOK && featureFlag('API_HOT_HOOKS');

export const DEFAULT_PAGE_SIZE = 100;

/** Props used to prevent query from refreshing - necessary during editing values */
export const NO_REFRESH_OPTIONS = {
  structuralSharing: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

/* eslint-disable no-inner-declarations, no-lone-blocks */

// https://tkdodo.eu/blog/effective-react-query-keys
export class EntityCacheKeyFactory {
  static factory(meta: OperationMeta<any>): EntityCacheKeyFactory {
    if (meta == null || meta.key == null) {
      console.debug(meta);
      throw new Error('OperationMeta is not supported as cache key factory');
    }

    if (meta.entityKey == null) {
      console.debug(meta);
      throw new Error('OperationMeta does not support entity keys');
    }

    return new EntityCacheKeyFactory(meta);
  }

  private scope: string[];

  // id key can be sort:primary or just primary (domainId:dataProductId)
  entityKeyFromParam(requestParameters: any): [string, string | undefined] {
    switch (this.meta.key) {
      case 'GovernancePolicyAttributesGroup':
      case 'GovernancePolicyAttributeValuesGroup': {
        const params: GetGovernancePolicyAttributesGroupRequest | GetGovernancePolicyAttributeValuesGroupRequest =
          requestParameters;
        const entityKey: (keyof typeof params)[] = ['group', 'ontologyNamespace', 'attributeId'];

        return [params.group, `${params.ontologyNamespace}.${params.attributeId}`];
      }
    }
    return getEntityKeyFromParam(this.meta.entityKey! as string[], requestParameters) as [string, string | undefined];
  }

  entityKeyFromEntity(entity: any): [string, string | undefined] {
    return getEntityKeyFromParam(this.meta.entityKey! as string[], entity) as [string, string | undefined];
  }

  private constructor(public readonly meta: OperationMeta<any>) {
    this.scope = [this.meta.key];
  }

  get all() {
    return this.scope;
  }

  get lists() {
    return this.scope.concat('list');
  }

  // TODO: list is either "paginated as infinite" or "array or [id, id]"
  list(params: any) {
    return this.lists.concat(JSON.stringify(params));
  }

  get entities() {
    return this.scope.concat('entity');
  }

  entity(id: string): [string];
  entity(sortKey: string, id: string): [string, string];
  entity(k1: string, k2?: string): [string] | [string, string] {
    return this.entities.concat(compact([k1, k2])) as [string] | [string, string];
  }
}

export type HookError = ApiError | Error;

//NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
function operationNameToHook(
  operationName: ApiTransformedOperationName,
  type?: 'infinite' | 'all' | 'waitFor' | 'mutateAsync' | 'batch' | 'fetch',
  lazy?: boolean,
): string {
  const action = getOperationAction(operationName);
  // capitalize the operation name
  const name = operationName.replace(action, '');
  const prefix = lazy ? 'useLazy' : type === 'waitFor' ? 'useWaitFor' : 'use';

  switch (action) {
    case OPERATION_ACTION.GET: {
      if (type === 'batch') {
        return `${prefix}Batch${name}`;
      } else if (type === 'fetch') {
        return `${prefix}Fetch${name}`;
      } else {
        return `${prefix}${name}`;
      }
    }
    case OPERATION_ACTION.LIST: {
      if (!pluralize.isPlural(name)) throw new Error(`List operation name must be plural: ${name}`);
      if (type === 'infinite') {
        return `${prefix}Paginated${name}`;
      } else if (type === 'all') {
        return `${prefix}All${name}`;
      } else if (type === 'batch') {
        return `${prefix}Batch${name}`;
      } else {
        return `${prefix}${name}`;
      }
    }
    default: {
      // name = pluralize.isPlural(name) ? pluralize.singular(name) : name;
      if (type === 'mutateAsync') {
        return `${prefix}${capitalize(action)}${name}Async`;
      }
      return `${prefix}${capitalize(action)}${name}`;
    }
  }
}

export const useApiInvalidation = () => {
  const queryClient = useQueryClient();

  const invalidateOperation = useCallback(
    (operationKey: NonEntityOperationKeys, action?: OPERATION_ACTION) => {
      return queryClient.invalidateQueries(action ? [operationKey, action] : [operationKey]);
    },
    [queryClient],
  );

  const invalidateEntityType = useCallback(
    (entityName: OperationEntityName) => {
      return queryClient.invalidateQueries([entityName]);
    },
    [queryClient],
  );

  const invalidateEntity = useCallback(
    (entityName: OperationEntityName, id: string, sortKey?: string) => {
      return queryClient.invalidateQueries([entityName, 'entity', ...(sortKey ? [sortKey, id] : [id])]);
    },
    [queryClient],
  );

  const invalidateEntityLists = useCallback(
    (entityName: OperationEntityName) => {
      return queryClient.invalidateQueries([entityName, 'list']);
    },
    [queryClient],
  );

  return useMemo(
    () => ({
      invalidateOperation,
      invalidateEntity,
      invalidateEntityLists,
      invalidateEntityType,
    }),
    [invalidateEntity, invalidateEntityLists, invalidateEntityType, invalidateOperation],
  );
};

export const useApiEntityQueryKey = (
  entityName: OperationEntityName,
  type?: 'entity' | 'list',
  params?: any,
): string[] => {
  return useMemo(() => {
    const key: string[] = [entityName];
    if (type) key.push(type);
    if (params) key.push(JSON.stringify(params));
    return key;
  }, [entityName, type, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
};

export type UseMappedKeyFn<T> = (item: T) => string;

export function useMapped<T, K = keyof T | UseMappedKeyFn<T>>(key: K, items: T[]): Record<string, T> {
  return useMemo(() => {
    if (items == null) return {};
    return items.reduce((map, item) => {
      // @ts-ignore: fix type mapping
      const itemKey: string = typeof key === 'string' ? item[key] : key(item);
      return {
        ...map,
        [itemKey]: item,
      };
    }, {});
  }, [key, items]);
}

//NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
export function generateApiHooks(api: ApiTransformedOperations): GeneratedApiHooks {
  return API_TRANSFORMED_OPERATION_KEYS.reduce(
    <
      OName extends ApiTransformedOperationName,
      ONameList extends ApiPaginatedOperationName = OName extends ApiPaginatedOperationName ? OName : never,
      OResponse = ApiTransformedOperationResponse<OName>,
      ORequest = ApiTransformedOperationRequest<OName>,
      O extends (...args: any[]) => Promise<any> = ApiTransformedOperation<OName>,
      OEntity = GetOperationEntity<OName>,
    >(
      hooks: any,
      operationName: OName,
    ) => {
      const metadata = getOperationMeta<OName>(operationName);
      const { key: operationKey, action, entityKey, listKey } = metadata;
      // wrap operation to make sure we resolve response stream
      // @ts-ignore
      const _operationFn: O = api[operationName].bind(api) as any;
      const operationFn: O = (async (...args: any[]): Promise<any> => {
        try {
          const response = await _operationFn(...args);
          if (response instanceof Response) {
            return await response.json();
          }
          return response;
        } catch (error: any) {
          if (error instanceof Response) {
            throw await error.json();
          }
          throw error;
        }
      }) as any;
      let entityKeyFactory: EntityCacheKeyFactory | null = null;
      const staticCacheKey = [operationKey];
      if (metadata.entityKey) entityKeyFactory = EntityCacheKeyFactory.factory(metadata);
      const isEntityBased = entityKeyFactory != null;

      function updateEntitiesCache(
        queryClient: QueryClient,
        queryKey: string[] | null,
        entities: any[],
        action: OPERATION_ACTION,
      ): void {
        if (!ENABLE_HOT_UPDATES) return;
        if (entityKeyFactory == null) throw new Error('updateEntitiesCache requires EntityCacheKeyFactory');
        const cache = queryClient.getQueryCache();
        compact(entities).forEach((operatingEntity) => {
          if (entityKeyFactory == null) return;
          const [sortKey, id] = entityKeyFactory.entityKeyFromEntity(operatingEntity) as [string, string];
          const entityKey = entityKeyFactory.entity(sortKey, id);
          if (isEqual(queryKey, entityKey)) return;

          // update individual "entity" caches after mutations
          if (MUTATION_ACTIONS.includes(action as any)) {
            const status = queryClient.getQueryState(entityKey);
            if (status && status.isFetching) queryClient.cancelQueries(entityKey);

            if (action === OPERATION_ACTION.DELETE) {
              console.debug(`[${action}] Revalidated entity: ${operationName}#${[sortKey, id]}`);
              // https://react-query.tanstack.com/reference/QueryClient#queryclientremovequeries
              queryClient.removeQueries(entityKey, { exact: true });
              EntityCacheEventEmitter.emit('entity.REMOVED', operationKey, [sortKey, id], operatingEntity);
            } else {
              console.debug(`[${action}] Revalidated entity: ${operationName}#${[sortKey, id]}`);
              queryClient.setQueriesData(entityKey, (current: any) => {
                const value = {
                  ...(current || {}),
                  ...operatingEntity,
                };
                EntityCacheEventEmitter.emit('entity.SET', operationKey, [sortKey, id], operatingEntity);
                return value;
              });
            }
          } else {
            // const entityQuery = cache.find(entityKey);
            const existingData = queryClient.getQueryData(entityKey);
            if (existingData) {
              if (!isDataEqual(existingData, operatingEntity)) {
                EntityCacheEventEmitter.emit('entity.SET', operationKey, [sortKey, id], operatingEntity);
              }
            } else {
              if (action === OPERATION_ACTION.LIST) {
                queryClient.setQueryData(entityKey, operatingEntity);
              }
              EntityCacheEventEmitter.emit('entity.SET', operationKey, [sortKey, id], operatingEntity);
            }
          }

          // update "list" entity caches
          if (typeof listKey === 'string') {
            const listQueries = cache.findAll(entityKeyFactory!.lists);
            listQueries.forEach((query) => {
              if (isDataEqual(query.queryKey, queryKey)) return; // ignore current list

              if (MUTATION_ACTIONS.includes(action as any)) {
                // cancel query when mutation occures that may contain stale item and force immediate refetch
                if (query.state.isFetching) {
                  query.cancel();
                  query.invalidate();
                  query.fetch();
                } else if (action === OPERATION_ACTION.GET) {
                  query.invalidate();
                }
              }

              // TODO: surgically update list entities across queries
            });
          }
        });
      }

      const useLazyState = <P, O, RP = Exclude<P extends Partial<infer I> ? I : never, never | unknown>>(
        initialParams: P,
        options?: O,
      ) => {
        const [enabled, setEnabled] = useState<boolean>(false);
        const [invokeParams, setInvokeParams] = useState<Partial<P>>();

        const lazyOptions = useMemo<O>(() => {
          return {
            ...(options || {}),
            // setting "enabled" will enable the `useQuery` to invoke the underlying operation as usual
            enabled: enabled && (options as any)?.enabled !== false,
          } as any;
        }, [options, enabled]);

        const lazyParams = useMemo<RP>(() => {
          return merge(cloneDeep(initialParams || {}), invokeParams || {}) as unknown as RP;
        }, [initialParams, invokeParams]);

        const invokeLazy = useCallback((_params: Partial<P>) => {
          setInvokeParams(_params);
          // setting "enabled" will enable the `useQuery` to invoke the underlying operation as usual
          setEnabled(true);
        }, []);

        return {
          invoke: invokeLazy,
          params: lazyParams,
          options: lazyOptions,
        };
      };

      const useExtendQueryResult = <
        OName extends ApiTransformedOperationName,
        R extends UseQueryResult | UseInfiniteQueryResult,
        ER = ExtendedUseQueryResult<OName, R>,
        TExtra extends object = {},
      >(
        queryKey: string[],
        result: R,
        access: OperationAccess,
        extra?: TExtra,
      ): ER => {
        const queryClient = useQueryClient();

        const invalidate = useCallback(() => {
          queryClient.invalidateQueries(queryKey);
        }, [queryKey, queryClient]);
        const refetch = useCallback(
          (options?: Parameters<ExtendedRefetch<R>>[0]): ReturnType<ExtendedRefetch<R>> => {
            if (options?.force) invalidate();
            return result.refetch(options) as ReturnType<ExtendedRefetch<R>>;
          },
          [invalidate, result.refetch],
        );

        const extendedResult = useMemo(() => {
          return {
            ...result,
            ...access,
            ...extra,
            queryKey,
            entityKeys: entityKeyFactory || undefined,
            invalidate,
            refetch,
          };
        }, [result, access, invalidate, refetch, extra, JSON.stringify(queryKey)]); // eslint-disable-line react-hooks/exhaustive-deps

        return extendedResult as unknown as ER;
      };

      switch (action) {
        case OPERATION_ACTION.GET: {
          const useFetch = () => {
            return useCallback<O>(
              (async (requestParameters: ORequest): Promise<OResponse> => {
                return await operationFn(requestParameters);
              }) as any,
              [operationFn], // eslint-disable-line react-hooks/exhaustive-deps
            );
          };

          const useGet = ((
            requestParameters: ORequest,
            options?: WithRequestOption<
              Omit<UseQueryOptions<OResponse, HookError, OResponse, QueryKey>, 'queryKey' | 'queryFn'>
            >,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();
            const queryFn = useCallback<() => Promise<OResponse>>(
              async () => operationFn(requestParameters as any, options?.request) as any,
              [requestParameters, options?.request],
            );

            const queryKey: string[] = useMemo(() => {
              if (entityKeyFactory) {
                const [sortKey, id] = entityKeyFactory.entityKeyFromParam(requestParameters) as [string, string];
                return entityKeyFactory.entity(sortKey, id);
              } else {
                return [...staticCacheKey, JSON.stringify(requestParameters)];
              }
            }, [requestParameters]);

            const queryOptions = useMemo(() => {
              return optionsWithoutRequest(options, access.isAllowed);
            }, [options, access]);

            const result = useQuery<OResponse, HookError>(queryKey, queryFn, {
              ...queryOptions,
              onSuccess: (data: OResponse) => {
                if (entityKeyFactory && isObject(result.data)) {
                  updateEntitiesCache(queryClient, queryKey, [result.data], action);
                }

                queryOptions?.onSuccess && queryOptions.onSuccess(data);
              },
            });

            const extendedResults = useExtendQueryResult<OName, UseQueryResult>(queryKey, result, access);

            return useMemo(() => {
              return [result.data, extendedResults];
            }, [result.data, extendedResults]);
          }) as UseGetOperation<OName>;

          const useLazyGet = ((
            requestParameters?: Partial<Parameters<typeof useGet>[0]>,
            options?: Parameters<typeof useGet>[1],
          ) => {
            const lazy = useLazyState(requestParameters, options);

            const result = useGet(lazy.params, lazy.options as any);

            return useMemo(() => {
              return [lazy.invoke, ...result];
            }, [lazy.invoke, result]);
          }) as UseLazyGetOperation<OName>;

          // TODO: need to test "waitForCondition" more, basic sanity check done
          const useWaitFor = (<
            TBaseOptions = Parameters<typeof useLazyGet>[1],
            TWaitForOptions = WaitForOptions<OResponse>,
            TOptions = TBaseOptions & TWaitForOptions,
          >(
            requestParameters?: Partial<Parameters<typeof useLazyGet>[0]>,
            options?: TOptions,
          ) => {
            const {
              waitForTimeout,
              waitForCondition,
              waitForConditionInterval = 5000,
            } = (options as WaitForOptions<OResponse>) || {};

            const waiting = useRef<boolean>(true);
            // const retry = useRef<boolean>(true);
            const [isWaitingForCondition, setIsWaitingForCondition] = useState(waitForCondition != null);
            const refetchTimer = useRef<NodeJS.Timer | number>();
            const timeoutTimer = useRef<NodeJS.Timer | number>();
            const baseOptions = useMemo<TBaseOptions>(() => {
              return omit(options || {}, ['onSuccess', 'waitForTimeout', 'waitForCondition']) as TBaseOptions;
            }, [options]);

            const onSuccessRef = useStatefulRef((options as any)?.onSuccess);

            const retryCallback = useCallback(() => waiting.current, []);
            // https://react-query.tanstack.com/guides/query-retries
            const waitForOptions = useMemo<TBaseOptions>(() => {
              return {
                // retry logic will handle the error cases
                retry: retryCallback,
                retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
                ...baseOptions,
              };
            }, [baseOptions, retryCallback]);

            const [invoke, data, queryInfo] = useLazyGet(requestParameters, waitForOptions);
            const dataRef = useStatefulRef(data);

            const stopWaiting = useCallback(() => {
              waiting.current = false;

              if (refetchTimer.current) {
                clearTimeout(refetchTimer.current as any);
                refetchTimer.current = undefined;
              }
              if (timeoutTimer.current) {
                clearTimeout(timeoutTimer.current as any);
                timeoutTimer.current = undefined;
              }

              onSuccessRef.current && onSuccessRef.current(dataRef.current);
            }, [dataRef, onSuccessRef]);

            // cleanup on unmount
            /* eslint-disable react-hooks/exhaustive-deps */
            useEffect(() => () => stopWaiting(), []);

            useEffect((): any => {
              // once query has started, start tracking against timeout
              if (!queryInfo.isIdle) {
                timeoutTimer.current = setTimeout(() => {
                  waiting.current = false;
                }, waitForTimeout || 30000);

                return () => timeoutTimer.current && clearTimeout(timeoutTimer.current as any);
              }
            }, [waitForTimeout, queryInfo.isIdle]);

            useEffect(() => {
              if (waiting.current) {
                if (queryInfo.data && refetchTimer.current == null) {
                  if (waitForCondition) {
                    if (waitForCondition(queryInfo.data as OResponse)) {
                      // condition has been met - all done waiting
                      stopWaiting();
                    } else {
                      // condition not met and data is stale, force invalidate
                      refetchTimer.current = setTimeout(() => {
                        // reset timer for next data update iteration
                        refetchTimer.current = undefined;
                        // force refetch of data
                        queryInfo.refetch({ force: true });
                      }, waitForConditionInterval);
                    }
                  } else {
                    stopWaiting();
                  }
                }
              }
            }, [queryInfo, waitForCondition, waitForConditionInterval]);

            return useMemo(() => {
              const isWaitingFor = waiting.current;

              const info: typeof queryInfo & WaitForResult = {
                ...(queryInfo as any),
                status: 'loading',
                isLoading: queryInfo.isLoading,
                isSuccess: isWaitingFor === false && queryInfo.isSuccess,
                isWaitingFor,
                isWaitingForCondition,
              };

              if (isWaitingFor) {
                return [invoke, undefined, info];
              } else {
                return [invoke, data, info];
              }
            }, [isWaitingForCondition, invoke, data, queryInfo]);
          }) as AsWaitFor<UseLazyGetOperation<OName>>;

          const useBatch = ((
            batch: ORequest[],
            options?: WithRequestOption<
              Omit<UseQueryOptions<OResponse, HookError, OResponse, QueryKey>, 'queryKey' | 'queryFn'>
            >,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();
            const queryOptions = useMemo(() => {
              return optionsWithoutRequest(options, access.isAllowed);
            }, [options, access]);

            const results = useQueries(
              batch.map((requestParameters) => {
                const [sortKey, id] = entityKeyFactory!.entityKeyFromParam(requestParameters) as [string, string];
                const queryKey = entityKeyFactory!.entity(sortKey, id);
                return {
                  queryKey,
                  queryFn: async () => operationFn(requestParameters as any, options?.request) as any,
                  ...(queryOptions as any),
                  onSuccess: (data: OResponse) => {
                    if (entityKeyFactory && !isEmpty(data)) {
                      updateEntitiesCache(queryClient, queryKey, [data], action);
                    }
                    queryOptions?.onSuccess && queryOptions.onSuccess(data);
                  },
                };
              }),
            );

            return useMemo(() => {
              const entities = results.map(({ data }) => data);

              return [entities, results, access];
            }, [results, access]);
          }) as UseBatchGetOperation<OName>;

          const useLazyBatch = ((
            batch?: Partial<Parameters<typeof useBatch>[0]>,
            options?: Parameters<typeof useBatch>[0],
          ) => {
            const lazy = useLazyState(batch, options);

            const result = useBatch(lazy.params, lazy.options as any);

            return useMemo(() => {
              return [lazy.invoke, ...result];
            }, [lazy.invoke, result]);
          }) as UseLazyBatchOperation<OName>;

          const _hooks = {
            [operationNameToHook(operationName, 'fetch')]: useFetch,
            [operationNameToHook(operationName)]: useGet,
            [operationNameToHook(operationName, undefined, true)]: useLazyGet,
            [operationNameToHook(operationName, 'waitFor')]: useWaitFor,
            // [operationNameToHook(operationName, 'waitFor', true)]: useWaitForAsync, // WIP
          };

          if (isEntityBased) {
            Object.assign(_hooks, {
              [operationNameToHook(operationName, 'batch')]: useBatch,
              [operationNameToHook(operationName, 'batch', true)]: useLazyBatch,
            });
          }

          return {
            ...hooks,
            ..._hooks,
          };
        }
        case OPERATION_ACTION.LIST: {
          const PAGINIATION_PARAMS: (keyof PagintationParams)[] = ['limit', 'nextToken', 'pageSize'];
          function onListSuccess(queryClient: QueryClient, queryKey: string[], result: any): void {
            // hot-replace entities defined in list
            // "select" already marshalls paginated results into array of entities
            if (listKey && Array.isArray(result) && !isEmpty(result)) {
              updateEntitiesCache(queryClient, queryKey, result, action);
            }
          }

          function listSelector<TData>(result: OResponse, select?: (data: TData) => TData): TData {
            let selectedResults = result as any;
            if (typeof listKey === 'string' && typeof result === 'object' && listKey in result) {
              selectedResults = (result as any)[listKey];
            }
            if (select) {
              return select(selectedResults);
            }
            return selectedResults;
          }

          // TODO: fix types
          const useListUtils = () => {
            // https://react-table.tanstack.com/docs/api/useTable#table-options
            // getRowId: Function(row, relativeIndex, ?parent) => string
            const getRowId = useCallback<UseListOperationUtils<OEntity>['getRowId']>(
              (item, relativeIndex, parent): string => {
                if (entityKey) {
                  const id: any = (entityKey as (keyof OEntity)[]).reduce((id, key): any => {
                    return id ? `${id}:${item[key]}` : item[key];
                  }, null);
                  if (id == null) {
                    console.debug(item);
                    throw new Error(`Failed to get entity id from key: ${String(item)} ${entityKey}`);
                  }
                  return id as string;
                } else {
                  // default react table row id
                  return parent ? [parent.id, relativeIndex].join('.') : String(relativeIndex);
                }
              },
              [],
            );

            return useMemo(
              () => ({
                getRowId,
              }),
              [getRowId],
            ) as any;
          };

          // https://react-query.tanstack.com/guides/paginated-queries
          const useList = (<TData = OEntity extends EntityTypes ? OEntity[] : OResponse>(
            requestParameters?: PagintationParams & ORequest,
            options?: WithRequestOption<
              Omit<UseQueryOptions<OResponse, HookError, TData, QueryKey>, 'queryKey' | 'queryFn'>
            >,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();
            const nextTokenParam = requestParameters?.nextToken; // use to ensure either controlled or uncontrolled paginiation
            const [nextToken, setNextToken] = useState<string>();

            const _requestParams: ORequest = omit(requestParameters || {}, PAGINIATION_PARAMS) as any;
            const _requestParamsHash = JSON.stringify(_requestParams);
            const _pageParams: PagintationParams = pick(requestParameters || {}, PAGINIATION_PARAMS) as any;
            const _pageParamsHash = JSON.stringify(_pageParams);

            useEffect(() => {
              // clear the next token if request params are changed
              setNextToken(undefined);
            }, [_requestParamsHash]);

            const marshalledParams = useMemo<PagintationParams & ORequest>(() => {
              return {
                ..._requestParams,
                ..._pageParams,
                nextToken: nextToken || _pageParams.nextToken,
              };
            }, [_requestParamsHash, _pageParamsHash, nextToken]);

            const queryFn = useCallback(async (): Promise<OResponse> => {
              const result: OResponse = await operationFn(marshalledParams, options?.request);

              return result;
            }, [marshalledParams, options?.request]);

            const queryKey: string[] = useMemo(() => {
              return entityKeyFactory
                ? entityKeyFactory.list(marshalledParams)
                : [...staticCacheKey, 'list', JSON.stringify(marshalledParams)];
            }, [marshalledParams]);

            const queryOptions = useMemo(() => {
              return optionsWithoutRequest(options, access.isAllowed);
            }, [options, access]);

            const onSuccess = useCallback(
              (result: any) => {
                onListSuccess(queryClient, queryKey, result);
                queryOptions?.onSuccess && queryOptions?.onSuccess(result);
              },
              [queryClient, queryKey, queryOptions?.onSuccess], // eslint-disable-line react-hooks/exhaustive-deps
            );

            const select = useCallback(
              (result: OResponse): TData => {
                return listSelector<TData>(result, queryOptions?.select as any);
              },
              [queryClient, listKey, queryOptions?.select], // eslint-disable-line react-hooks/exhaustive-deps
            );

            const result = useQuery<OResponse, HookError, TData>(queryKey, queryFn, {
              keepPreviousData: true,
              ...queryOptions,
              select,
              onSuccess,
            });

            const extendedResults = useExtendQueryResult(queryKey, result, access);

            const nextTokenResult = (result.data as any)?.nextToken as string | undefined;

            const fetchNextPage = useCallback(() => {
              if (nextTokenParam) {
                throw new Error(
                  'Paginated list must be either controlled `nextToken` param or uncontrolled via `fetchNextPage`, but not both.',
                );
              }
              setNextToken(nextTokenResult);
            }, [nextTokenParam, setNextToken, nextTokenResult]);

            const UNSET_PAGINATION_OBJECT = useMemo(
              () => ({
                fetchNextPage,
                hasNextPage: undefined,
                pageSize: DEFAULT_PAGE_SIZE,
                nextToken: undefined,
              }),
              [nextTokenParam],
            );

            const [pagination, setPagination] = useState<UseListOperationPaginationObject>(UNSET_PAGINATION_OBJECT);

            useEffect(() => {
              if (result.isError) {
                setPagination(UNSET_PAGINATION_OBJECT);
              } else if (result.isFetched) {
                setPagination({
                  nextToken: nextTokenResult,
                  hasNextPage: nextTokenResult != null,
                  pageSize: marshalledParams?.pageSize || DEFAULT_PAGE_SIZE,
                  fetchNextPage,
                });
              }
            }, [fetchNextPage, marshalledParams?.pageSize, result.isFetched, nextTokenResult]); // eslint-disable-line react-hooks/exhaustive-deps

            const listUtils = useListUtils();

            return useMemo(() => {
              // @ts-ignore Expression produces a union type that is too complex to represent.ts(2590)
              return [extendedResults.data, { ...extendedResults, ...pagination, ...listUtils }];
            }, [extendedResults, pagination, listUtils]);
          }) as UseListOperation<ONameList>;

          const useLazyList = ((
            pageParams?: Partial<Parameters<typeof useList>[0]>,
            options?: Parameters<typeof useList>[1],
          ) => {
            const lazy = useLazyState(pageParams, options);

            const result = useList(lazy.params, lazy.options as any);

            return useMemo(() => {
              return [lazy.invoke, ...result];
            }, [lazy.invoke, result]);
          }) as UseLazyListOperation<ONameList>;

          // TOOD: extend 'useBatchList' to support "non-entity" based lists
          const useBatchList = (<
            TData = OEntity[],
            TUseQueryResult = ExtendedUseQueryResult<ONameList, UseQueryResult<TData, HookError>>,
          >(
            batch: ORequest[],
            options?: WithRequestOption<
              Omit<UseQueryOptions<OResponse, HookError, TData, QueryKey>, 'queryKey' | 'queryFn' | 'select'>
            >,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();
            const queryOptions = useMemo(() => {
              return optionsWithoutRequest(options, access.isAllowed);
            }, [options, access]);

            const results = useQueries(
              batch.map((requestParameters) => {
                const queryKey = entityKeyFactory
                  ? entityKeyFactory.list(requestParameters)
                  : [...staticCacheKey, 'list'];
                return {
                  queryKey,
                  queryFn: async () => operationFn(requestParameters as any, options?.request) as any,
                  ...(queryOptions as any),
                  select: (result: OResponse): TData => {
                    return listSelector<TData>(result);
                  },
                  onSuccess: (result: TData) => {
                    return onListSuccess(queryClient, queryKey, result);
                  },
                };
              }),
            );

            return useMemo<[TData | undefined, TUseQueryResult[], OperationAccess]>(() => {
              let batchResults = results.flatMap(({ data }) => data) as any;

              if (entityKeyFactory) {
                batchResults = compact(batchResults || []);
              }

              return [batchResults, results as unknown as TUseQueryResult[], access];
            }, [results, access]);
          }) as unknown as UseBatchListOperation<ONameList>;

          // https://react-query.tanstack.com/guides/infinite-queries
          const useInfinite = (<TData = OEntity extends EntityTypes ? OEntity[] : OResponse>(
            requestParameters?: Omit<ORequest, 'nextToken'> & BasePaginationParams,
            options?: ExtendedInfiniteOptions<ORequest, OResponse, TData>,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();
            const requestParametersHash = JSON.stringify(requestParameters);
            // const [livePageParams, overridePageParams] = useState<Omit<PagintationParams, 'nextToken'>>();
            // TODO: need to expose "pageSize" (the actual resolved pageSize) in results object
            const propsPageParams = interpBasePageParams(requestParameters);
            const propsPageParamsHash = JSON.stringify(propsPageParams);
            const [basePageParams, setBasePageParams] = useState<BasePaginationParams>(propsPageParams);

            useEffect(() => {
              setBasePageParams(propsPageParams);
            }, [propsPageParamsHash]);

            const queryFn = useCallback(
              async ({ pageParam }): Promise<OResponse> => {
                const _basePageParams = interpBasePageParams(basePageParams, pageParam);
                setBasePageParams((current) => {
                  if (isDataEqual(_basePageParams, current)) return current;
                  return _basePageParams;
                });
                const result: OResponse = await operationFn(
                  { ...requestParameters, ..._basePageParams, ...pageParam },
                  options?.request,
                );

                options?.onResponse && options.onResponse(result);

                return result;
              },
              [requestParametersHash, basePageParams, options?.request, options?.onResponse],
            );

            const queryKey: string[] = useMemo(() => {
              const params = { ...requestParameters, ...basePageParams };
              return entityKeyFactory
                ? entityKeyFactory.list(['infinite', params])
                : [...staticCacheKey, 'infinite', JSON.stringify(params)];
            }, [requestParametersHash, basePageParams]);

            const queryOptions = useMemo(() => {
              return optionsWithoutRequest(options, access.isAllowed);
            }, [options, access]);

            const select = useCallback(
              ({ pageParams, pages }: InfiniteData<OResponse>): InfiniteData<TData> => {
                return {
                  pageParams,
                  pages: pages.map((page) => listSelector<TData>(page, queryOptions?.select as any)),
                };
              },
              [queryClient, listKey, queryOptions?.select], // eslint-disable-line react-hooks/exhaustive-deps
            );

            const result = useInfiniteQuery<OResponse, HookError, TData>(queryKey, queryFn, {
              // https://react-query.tanstack.com/guides/infinite-queries
              getNextPageParam: (lastPage: OResponse, pages: OResponse[]) => {
                const nextToken = (lastPage as PaginatedResponse)?.nextToken;
                // return undefined to indicate no more pages to fetch
                if (nextToken == null) return undefined;
                return { nextToken };
              },
              ...queryOptions,
              select,
              onSuccess: (data) => {
                if (data) {
                  // send the last retrieved page to success handler to update cache
                  data.pages && onListSuccess(queryClient, queryKey, last(data.pages));
                  options?.onSuccess && options.onSuccess(data as any);
                }
              },
            });

            const listUtils = useListUtils();

            const pageSize = basePageParams.pageSize;
            const hasNextPage = result.hasNextPage;
            const extra = useMemo<ExtraInfiniteResults<TData, OEntity>>(() => {
              if (result.data == null) {
                return {
                  ...listUtils,
                  pageCount: -1, // unknown
                  pageSize,
                };
              }

              const { pageParams, pages } = result.data;
              // TODO: replace pageCount once we know total items and can derive - use -1 while unknown
              const pageCount = hasNextPage ? -1 : pages.length;

              return {
                ...listUtils,
                pageCount,
                pageSize,
              };
            }, [result.data, hasNextPage, listUtils, pageSize]);

            return useExtendQueryResult<OName, UseInfiniteQueryResult>(queryKey, result, access, extra);
          }) as unknown as UseInfiniteListOperation<ONameList>;

          const useAll = (<TData = OEntity extends EntityTypes ? OEntity[] : OResponse>(
            params: Parameters<typeof useInfinite>[0],
            options?: Parameters<typeof useInfinite>[1] & ListAllOptions,
          ) => {
            const waitForAll = options?.waitForAll === true;

            const infiniteResults = useInfinite(params as any, options);
            const pages = infiniteResults.data?.pages;
            const { hasNextPage, fetchNextPage, isLoading } = infiniteResults;

            useEffect(() => {
              if (hasNextPage) {
                fetchNextPage();
              }
            }, [hasNextPage, fetchNextPage, pages]); // eslint-disable-line react-hooks/exhaustive-deps

            const all = useMemo<any[] | undefined>(() => {
              if (isEmpty(pages)) return undefined;

              return (pages || []).reduce((all, page) => {
                if (Array.isArray(page)) {
                  return all.concat(page);
                }
                return all.concat([page]);
              }, [] as any[]);
            }, [pages]);

            return useMemo(() => {
              if (waitForAll && (hasNextPage || isLoading)) {
                return [undefined, infiniteResults];
              }
              return [all, infiniteResults];
            }, [all, hasNextPage, waitForAll, infiniteResults]);
          }) as UseListAllOperation<ONameList>;

          const useLazyAll = ((
            params?: Partial<Parameters<typeof useAll>[0]>,
            options?: Parameters<typeof useAll>[1],
          ) => {
            const lazy = useLazyState(params, options);
            const result = useAll(lazy.params, lazy.options as any);

            return useMemo(() => {
              return [lazy.invoke, ...result];
            }, [lazy.invoke, result]);
          }) as UseLazyAllOperation<ONameList>;

          // @ts-ignore: Expression produces a union type that is too complex to represent.ts(2590)
          const _hooks = {
            [operationNameToHook(operationName)]: useList,
            [operationNameToHook(operationName, undefined, true)]: useLazyList,
            [operationNameToHook(operationName, 'all')]: useAll,
            [operationNameToHook(operationName, 'all', true)]: useLazyAll,
            [operationNameToHook(operationName, 'infinite')]: useInfinite,
            // [operationNameToHook(operationName, 'infinite', true)]: useLazyInfinite,
          } as any;

          if (isEntityBased) {
            Object.assign(_hooks, {
              [operationNameToHook(operationName, 'batch')]: useBatchList,
              // [operationNameToHook(operationName, 'batch', true)]: useLazyBatchList,
            });
          }

          return {
            ...hooks,
            ..._hooks,
          };
        }
        case OPERATION_ACTION.DELETE:
        case OPERATION_ACTION.POST:
        case OPERATION_ACTION.PUT: {
          const useOperationMutation = ((
            options?: WithRequestOption<
              Omit<UseMutationOptions<OResponse, HookError, ORequest>, 'mutationKey' | 'mutationFn'>
            >,
          ) => {
            const access = useOperationAccess(operationName);
            const queryClient = useQueryClient();

            const mutationFn = useCallback(
              async (requestParameters: ORequest): Promise<OResponse> => {
                const result = (await operationFn(requestParameters as any, options?.request)) as any;
                // update the corelating entity - only if we can retrieve entity keys from result
                if (entityKeyFactory && Array.isArray(entityKey)) {
                  if (
                    has(result, entityKey[0] as string) &&
                    (entityKey.length === 1 || has(result, entityKey[1] as string))
                  ) {
                    updateEntitiesCache(queryClient, null, [result], action);
                  } else {
                    console.warn(
                      'Failed to update entity after mutation as result was missing keys',
                      entityKey,
                      result,
                    );
                  }
                }
                return result;
              },
              [queryClient, options?.request],
            );

            const result = useMutation<OResponse, HookError, ORequest>(
              mutationFn,
              optionsWithoutRequest(options, access.isAllowed),
            );

            const extendedResult = useMemo(() => {
              return {
                ...result,
                ...access,
              };
            }, [result, access]);

            return [result.mutate, extendedResult];
          }) as unknown as UseMutationOperation<OName>; // TODO: fix ultimiate typings

          const useOperationMutationAsync = ((options?: Parameters<typeof useOperationMutation>[0]) => {
            const [, mutationInfo] = useOperationMutation(options);

            return useMemo(() => {
              return [mutationInfo.mutateAsync, mutationInfo];
            }, [mutationInfo]);
          }) as unknown as UseMutationOperationAsync<OName>; // TODO: fix ultimiate typings

          return {
            ...hooks,
            [operationNameToHook(operationName)]: useOperationMutation,
            [operationNameToHook(operationName, 'mutateAsync')]: useOperationMutationAsync,
          };
        }
      }
    },
    {},
  ) as any;
}

type RequestOption = { request?: RequestInit };
type WithRequestOption<T> = T & RequestOption;

function optionsWithoutRequest<T extends RequestOption & { enabled?: boolean }>(
  options?: T,
  allow?: boolean,
): Omit<T, keyof RequestOption> | undefined {
  const _options: any = omit(options || {}, 'request');
  _options.enabled = allow !== false && options?.enabled !== false;
  return _options;
}

export type GetGeneratedApiHooks = {
  [OName in ApiTransformedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.GET
    ? `use${GetOperationKey<OName>}`
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.GET ? UseGetOperation<OName> : never;
};

export type FetchGeneratedApiHooks = {
  [OName in ApiTransformedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.GET
    ? `useFetch${GetOperationKey<OName>}`
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.GET ? UseFetchOperation<OName> : never;
};

export type ListGeneratedApiHooks = {
  [OName in ApiPaginatedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.LIST
    ? `use${Pluralize<GetOperationKey<OName>>}`
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.LIST ? UseListOperation<OName> : never;
};
// type TEST_ListGeneratedApiHooks = keyof ListGeneratedApiHooks

export type MutationGeneratedApiHooks = {
  [OName in ApiTransformedOperationName as InferOperationAction<OName> extends MUTATION_ACTIONS
    ? `use${Capitalize<string & InferOperationAction<OName>>}${GetOperationKey<OName>}`
    : never]: InferOperationAction<OName> extends MUTATION_ACTIONS ? UseMutationOperation<OName> : never;
};

export type BaseGeneratedApiHooks = GetGeneratedApiHooks &
  FetchGeneratedApiHooks &
  ListGeneratedApiHooks &
  MutationGeneratedApiHooks;

export type ListAllGeneratedApiHooks = {
  [OName in ApiPaginatedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.LIST
    ? `useAll${Pluralize<GetOperationKey<OName>>}`
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.LIST ? UseListAllOperation<OName> : never;
};

export type ListLikeGeneratedApiHooks = ListGeneratedApiHooks & ListAllGeneratedApiHooks;

export type PaginatedGeneratedApiHooks = {
  [OName in ApiPaginatedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.LIST
    ? `usePaginated${Pluralize<GetOperationKey<OName>>}`
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.LIST ? UseInfiniteListOperation<OName> : never;
};

// type TEST_PaginatedGeneratedApiHooks = PaginatedGeneratedApiHooks['usePaginatedIdentityGroups']

export type BatchGetGeneratedApiHooks = {
  [OName in ApiTransformedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.GET
    ? IsEntityOperation<OName> extends true
      ? `useBatch${GetOperationKey<OName>}`
      : never
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.GET ? UseBatchGetOperation<OName> : never;
};

export type BatchListGeneratedApiHooks = {
  [OName in ApiPaginatedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.LIST
    ? IsEntityOperation<OName> extends true
      ? `useBatch${Pluralize<GetOperationKey<OName>>}`
      : never
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.LIST ? UseBatchListOperation<OName> : never;
};

export type WaitForGeneratedApiHooks = {
  [OName in ApiTransformedOperationName as InferOperationAction<OName> extends OPERATION_ACTION.GET
    ? IsEntityOperation<OName> extends true
      ? `useWaitFor${GetOperationKey<OName>}`
      : never
    : never]: InferOperationAction<OName> extends OPERATION_ACTION.GET ? AsWaitFor<UseGetOperation<OName>> : never;
};

// type TEST_BatchGeneratedApiHooks = BatchGeneratedApiHooks['useBatchApiAccessPolicy']

export type NonLazyGeneratedApiHooks = BaseGeneratedApiHooks &
  ListAllGeneratedApiHooks &
  PaginatedGeneratedApiHooks &
  BatchGetGeneratedApiHooks &
  BatchListGeneratedApiHooks &
  WaitForGeneratedApiHooks;

export type LazyGeneratedApiHooks = {
  [P in keyof NonLazyGeneratedApiHooks as P extends `use${Capitalize<MUTATION_ACTIONS>}${string}`
    ? never
    : P extends `use${infer S}`
    ? `useLazy${S}`
    : never]: NonLazyGeneratedApiHooks[P] extends (...args: any[]) => any
    ? AsUseLazy<NonLazyGeneratedApiHooks[P]>
    : never;
};

export type MutateAsyncGeneratedApiHooks = {
  [P in keyof NonLazyGeneratedApiHooks as P extends `use${Capitalize<QUERY_ACTIONS>}${string}`
    ? never
    : P extends `use${infer S}`
    ? `use${S}Async`
    : never]: NonLazyGeneratedApiHooks[P] extends UseMutationOperation<infer OName>
    ? UseMutationOperationAsync<OName>
    : never;
};

export type GeneratedApiHooks = NonLazyGeneratedApiHooks & LazyGeneratedApiHooks & MutateAsyncGeneratedApiHooks;

export type AsUseLazy<
  T extends (...args: any[]) => any,
  TPOR extends [any, any, any] = T extends (p: infer P, o: infer O) => infer R ? [P, O, R] : [never, never, never],
  TParams = TPOR[0],
  TOptions = TPOR[1],
  TReturn extends any[] = TPOR[2] extends any[] ? TPOR[2] : never,
  TInvokeLazy = (overrides?: TParams extends any[] ? TParams : Partial<TParams>) => void,
> = (initial?: Partial<TParams>, options?: TOptions) => [TInvokeLazy, ...TReturn];

export type AsWaitFor<T extends (...args: any[]) => any, TLazy = AsUseLazy<T>> = TLazy extends (
  initial?: infer P,
  options?: infer O,
) => infer R
  ? (
      initial?: P,
      options?: O &
        WaitForOptions<R extends ReturnType<UseLazyGetOperation<infer O>> ? ApiOperationResponse<O> : never>,
    ) => R extends [infer R0, infer R1, infer R2] ? [R0, R1, R2 & WaitForResult] : never
  : never;

export type UseFetchOperation<
  OName extends ApiTransformedOperationName,
  ORequest = ApiTransformedOperationRequest<OName>,
  OResponse = ApiTransformedOperationResponse<OName>,
> = () => (requestParameters: ORequest) => Promise<OResponse>;
// type TEST_UseFetchOperation = UseFetchOperation<'getDataProductDomain'>

export type UseGetOperation<
  OName extends ApiTransformedOperationName,
  ORequest = ApiTransformedOperationRequest<OName>,
  OResponse = ApiTransformedOperationResponse<OName>,
  TUseQueryResult = ExtendedUseQueryResult<OName, UseQueryResult<OResponse, HookError>>,
  TOptions = WithRequestOption<
    Omit<UseQueryOptions<OResponse, HookError, OResponse, QueryKey>, 'queryKey' | 'queryFn' | 'select'>
  >,
> = (requestParameters: ORequest, options?: TOptions) => [OResponse | undefined, TUseQueryResult];
// type TEST_UseGetOperation = UseGetOperation<'getDataProductDomain'>
// TODO: jerjonas - `getIdentityAttributes` does not have `requestParameters`
// type TEST_UseGetOperation = UseGetOperation<'getIdentityAttributes'>

export type UseLazyGetOperation<OName extends ApiTransformedOperationName> = AsUseLazy<UseGetOperation<OName>>;

export type UseBatchGetOperation<
  OName extends ApiTransformedOperationName,
  ORequest = ApiTransformedOperationRequest<OName>,
  OResponse = ApiTransformedOperationResponse<OName>,
  TUseQueryResult = UseQueryResult<OResponse, HookError>,
  TOptions = WithRequestOption<
    Omit<UseQueryOptions<OResponse, HookError, OResponse, QueryKey>, 'queryKey' | 'queryFn'>
  >,
> = (batch: ORequest[], options?: TOptions) => [(OResponse | undefined)[], TUseQueryResult[], OperationAccess];

export type UseLazyBatchOperation<OName extends ApiTransformedOperationName> = AsUseLazy<UseBatchGetOperation<OName>>;

type ApiResultSelect<TData> = (data: TData) => TData;
type ApiUseQueryOptions<TQueryResult, TData> = WithRequestOption<
  Omit<UseQueryOptions<TQueryResult, HookError, TData, QueryKey>, 'queryKey' | 'queryFn' | 'select'> & {
    select?: ApiResultSelect<TData>;
  }
>;

export type UseListOperation<
  OName extends ApiPaginatedOperationName,
  ORequest = ApiPaginatedOperationRequest<OName>,
  OResponse = ApiPaginatedOperationResponse<OName>,
  OEntity extends EntityTypes | false = GetOperationEntity<OName> extends never ? false : GetOperationEntity<OName>,
  TData = OEntity extends false ? OResponse : OEntity[],
  TUseQueryResult = ExtendedUseQueryResult<OName, UseQueryResult<TData, HookError>>,
  TOptions = ApiUseQueryOptions<OResponse, TData>,
> = (
  pageParam?: PagintationParams & ORequest,
  options?: TOptions,
) => [TData | undefined, TUseQueryResult & UseListOperationPaginationObject & UseListOperationUtils<OEntity>];
// type TEST_UseListOperationReturn = ReturnType<UseListOperation<'listCosts'>>
// type TEST_UseListOperationReturn2 = ReturnType<UseListOperation<'listDataProductDomains'>>

// @ts-ignore: Expression produces a union type that is too complex to represent.ts(2590)
export type UseLazyListOperation<OName extends ApiPaginatedOperationName> = AsUseLazy<UseListOperation<OName>>;

export type UseBatchListOperation<
  OName extends ApiPaginatedOperationName,
  ORequest = ApiPaginatedOperationRequest<OName>,
  OResponse = ApiPaginatedOperationResponse<OName>,
  OEntity = GetOperationEntity<OName>,
  TData = OEntity extends false ? OResponse : OEntity[],
  TUseQueryResult = ExtendedUseQueryResult<OName, UseQueryResult<TData, HookError>>,
  TOptions = ApiUseQueryOptions<OResponse, TData>,
> = OEntity extends EntityTypes
  ? (batch: ORequest[], options?: TOptions) => [TData, TUseQueryResult[], OperationAccess]
  : never;

// // type TEST_UseBatchListOperation = UseBatchListOperation<'listQuerySavedQueries'>

// export type UseLazyBatchListOperation<OName extends ApiPaginatedOperationName> = AsUseLazy<UseBatchListOperation<OName>>;

// TODO: jerjonas - omit 'fetchNextPage' from result info for better auto table handling
export type UseListAllOperation<
  OName extends ApiPaginatedOperationName,
  TResult = ReturnType<UseInfiniteListOperation<OName>>,
  TAll = TResult extends { data: { pages: (infer IPage)[] } } ? IPage : never,
  // OResponse = ApiPaginatedOperationResponse<OName>,
  // OEntity extends EntityTypes | false = GetOperationEntity<OName> extends never ? false : GetOperationEntity<OName>,
  // TData = OEntity extends false ? OResponse : OEntity[],
  // TAll = TData extends any[] ? TData : TData[]
> = (
  params?: Parameters<UseInfiniteListOperation<OName>>[0],
  options?: Parameters<UseInfiniteListOperation<OName>>[1] & ListAllOptions,
) => [TAll | undefined, ReturnType<UseInfiniteListOperation<OName>>];

// @ts-ignore: Expression produces a union type that is too complex to represent.ts(2590)
export type UseLazyAllOperation<OName extends ApiPaginatedOperationName> = AsUseLazy<UseListAllOperation<OName>>;

type ExtraInfiniteResults<TData, OEntity> = UseListOperationUtils<OEntity> & {
  pageCount: number;
  pageSize: number;
};

type ExtendedInfiniteOptions<ORequest, OResponse, TData> = WithRequestOption<
  Omit<UseInfiniteQueryOptions<OResponse, HookError, TData>, 'queryKey' | 'queryFn' | 'select'>
> & {
  select?: (data: TData) => TData;
  /**
   * Callback handler for raw operation response
   */
  onResponse?: (response: OResponse) => void;
};

export type UseInfiniteListOperation<
  OName extends ApiPaginatedOperationName,
  ORequest = Omit<ApiPaginatedOperationRequest<OName>, 'nextToken'>,
  OResponse = ApiPaginatedOperationResponse<OName>,
  OEntity extends EntityTypes | false = GetOperationEntity<OName> extends never ? false : GetOperationEntity<OName>,
  TData = OEntity extends false ? OResponse : OEntity[],
  TUseQueryResult = ExtendedUseQueryResult<
    OName,
    UseInfiniteQueryResult<TData, HookError>,
    ExtraInfiniteResults<TData, OEntity>
  >,
  TOptions = ExtendedInfiniteOptions<ORequest, OResponse, TData>,
> = (pageParam?: ORequest, options?: TOptions) => TUseQueryResult;

export type UseMutationOperation<
  OName extends ApiTransformedOperationName,
  ORequest = ApiTransformedOperationRequest<OName>,
  OResponse = ApiTransformedOperationResponse<OName>,
  TOptions = WithRequestOption<Omit<UseMutationOptions<OResponse, HookError, ORequest>, 'mutationKey' | 'mutationFn'>>,
  TUseMutationResult = UseMutationResult<OResponse, HookError, ORequest> & OperationAccess,
> = (options?: TOptions) => [TUseMutationResult extends { mutate: infer M } ? M : never, TUseMutationResult];

export type UseMutationOperationAsync<
  OName extends ApiTransformedOperationName,
  ORequest = ApiTransformedOperationRequest<OName>,
  OResponse = ApiTransformedOperationResponse<OName>,
  TOptions = WithRequestOption<Omit<UseMutationOptions<OResponse, HookError, ORequest>, 'mutationKey' | 'mutationFn'>>,
  TUseMutationResult = UseMutationResult<OResponse, HookError, ORequest> & OperationAccess,
> = (options?: TOptions) => [TUseMutationResult extends { mutateAsync: infer M } ? M : never, TUseMutationResult];

export interface ExtendedRefetch<
  T extends UseQueryResult | UseInfiniteQueryResult,
  TOptions = Parameters<T['refetch']>[0],
  TReturn = ReturnType<T['refetch']>,
> {
  (options: TOptions & { force?: boolean }): TReturn;
}

export type ExtendedUseQueryResult<
  OName extends ApiTransformedOperationName,
  T extends UseQueryResult | UseInfiniteQueryResult,
  TExtra = {},
> = T &
  TExtra & {
    queryKey: string[];
    invalidate: () => void;
    refetch: ExtendedRefetch<T>;
    entityKeys: IsEntityOperation<OName> extends true ? EntityCacheKeyFactory : never;
  } & OperationAccess;

export interface UseListOperationPaginationObject {
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  pageSize: number | undefined;
  nextToken: string | undefined;
}

export interface UseListOperationUtils<T> {
  // https://react-table.tanstack.com/docs/api/useTable#table-options
  getRowId: (row: T extends EntityTypes ? T : any, relativeIndex: number, parent?: any) => string;
}

export interface ListAllOptions {
  /**
   * Wait for all results to be fetched (no more pages) before returning result data.
   *
   * Useful for form initial data that can only be set during initialization of form.
   *
   * @default false
   */
  waitForAll?: boolean;
}

export interface WaitForOptions<TResult> {
  /**
   * Max duration to wait before failing.
   * @default 30000 (30 seconds)
   */
  waitForTimeout?: number;
  /**
   * Condition to by truthy before return results and stop waiting for.
   *
   * **CAUTION:** ensure to use memorized function (useMemo or useCallback)
   */
  waitForCondition?: (result: TResult) => boolean;
  /**
   * Interval to poll data when checking for conditional to be met.
   * @default 5000 (5 seconds)
   */
  waitForConditionInterval?: number;
}

export interface WaitForResult {
  isWaitingFor: boolean;
  isWaitingForCondition: boolean;
}

export type UseOperationResult = UseQueryResult | UseMutationResult;

export type OperationError = ApiError;

export interface OperationMonitorResult {
  hasLoading: boolean;
  hasError: boolean;
  errorValues: (OperationError | null)[];
  errors?: OperationError[];
}

export function useOperationMonitor(...operations: UseOperationResult[]): OperationMonitorResult {
  const hasLoading = useMemo(
    () => {
      return operations.find((o) => o.isLoading === true) != null;
    },
    operations.map((o) => o.isLoading),
  );

  const resolvedErrorValues = useMemo(() => new Map<unknown, OperationError>(), []);
  const rawErrors = operations.map((o) => o.error);
  // prefill errorValues will null to preserve length for deps
  const [errorValues, setErrorValues] = useState<(OperationError | null)[]>(() => rawErrors.map(() => null));

  useEffect(() => {
    (async () => {
      const errors: (OperationError | null)[] = [];
      for (const error of rawErrors) {
        if (error == null) {
          errors.push(null);
          continue;
        } else if (!resolvedErrorValues.has(error)) {
          // for ReadableStreams we can only call .json() once, so we need to persist resolved error
          resolvedErrorValues.set(error, {
            ...(await extractErrorDetails(error)),
          });
        }
        errors.push(resolvedErrorValues.get(error) as OperationError);
      }
      setErrorValues(errors);
    })();
  }, [resolvedErrorValues, ...rawErrors]);

  return useMemo<OperationMonitorResult>(() => {
    const errors = compact(errorValues);
    const hasError = !isEmpty(errors);
    return {
      hasLoading,
      errorValues,
      hasError,
      errors: hasError ? errors : undefined,
    };
  }, [hasLoading, errorValues]);
}

const extractErrorDetails = async (error: any): Promise<ApiError> => {
  // TODO: see if we can standardize the error handling and show contextual details
  try {
    if (isFetchApiResponse(error)) {
      return await error.json();
    }

    if (error?.response?.data) {
      // Errors thrown by failed Amplify requests
      return error.response.data;
    }

    return { message: error.message };
  } catch (tryError) {
    console.warn(tryError);
    return { message: error.message };
  }
};

function isFetchApiResponse(potentialResponse: any): potentialResponse is Response {
  if (potentialResponse == null) return false;
  return potentialResponse instanceof Response;
}

type BasePaginationParams = Omit<PagintationParams, 'nextToken'>;
function interpBasePageParams(...baseParameters: (BasePaginationParams | undefined)[]): BasePaginationParams {
  const params = Object.assign({}, ...baseParameters);
  return omitBy(
    {
      pageSize: params?.pageSize || DEFAULT_PAGE_SIZE,
      limit: params?.limit,
    },
    isNil,
  );
}
