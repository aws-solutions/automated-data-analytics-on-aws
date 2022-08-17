/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiPaginatedOperationName, EntityTypes, GetOperationEntity } from '@ada/api/client/types';
import { BaseTable, BaseTableProps } from './BaseTable';
import { ErrorBoundary } from '../errors';
import { UseListAllOperation } from '$api/hooks/generator';
import { useI18nContext } from '$strings';
import React, { useMemo } from 'react';

export interface AllQueryResultTableProps<
  OName extends ApiPaginatedOperationName,
  THook extends (...args: any[]) => any = UseListAllOperation<OName>,
  THookResult extends any = ReturnType<THook>,
  OEntity extends EntityTypes | false = GetOperationEntity<OName> extends never ? false : GetOperationEntity<OName>,
> extends Omit<BaseTableProps<OEntity extends EntityTypes ? OEntity : object>, 'errorText' | 'items'> {
  readonly allQueryResult: THookResult;
  readonly errorText?: string | ((error: any) => string | undefined);
}

export type ConstrainedAllQueryResultTableProps<T extends ApiPaginatedOperationName> = Omit<
  AllQueryResultTableProps<T>,
  'allQueryResult' | 'columnDefinitions'
>;

export const AllQueryResultTable = <T extends ApiPaginatedOperationName>({
  allQueryResult,
  errorText: errorTextProp,
  ...props
}: AllQueryResultTableProps<T>) => {
  const { LL } = useI18nContext();

  const [items, queryInfo] = allQueryResult;

  // TODO: create generic error handling for list table results
  const queryResultError = queryInfo.error;
  const errorText = useMemo<string | undefined>(() => {
    if (queryResultError == null) return undefined;

    if (errorTextProp) {
      if (typeof errorTextProp === 'function') {
        return errorTextProp(queryResultError);
      }
      return errorTextProp;
    }

    if (queryResultError.message) {
      return LL.VIEW.error.failedToFetchDetailed({ details: queryResultError.message });
    }
    return LL.VIEW.error.failedToFetch();
  }, [errorTextProp, queryResultError]);

  return (
    <ErrorBoundary>
      <BaseTable
        items={items as any}
        errorText={errorText}
        defaultPageSize={queryInfo.pageSize}
        loading={queryInfo.isLoading}
        getRowId={queryInfo.getRowId}
        {...props}
      />
    </ErrorBoundary>
  );
};
