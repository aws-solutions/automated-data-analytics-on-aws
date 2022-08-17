/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiPaginatedOperationName, EntityTypes, GetOperationEntity } from '@ada/api/client/types';
import { BaseTable, BaseTableProps } from './BaseTable';
import { ErrorBoundary } from '../errors';
import { FetchDataOptions } from 'aws-northstar/components/Table';
import { UseInfiniteListOperation } from '$api/hooks/generator';
import { isEmpty } from 'lodash';
import { useI18nContext } from '$strings';
import { useStatefulRef } from '$common/hooks';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface PaginatedQueryResultTableProps<
  OName extends ApiPaginatedOperationName,
  THook extends (...args: any[]) => any = UseInfiniteListOperation<OName>,
  THookResult extends any = ReturnType<THook>,
  OEntity extends EntityTypes | false = GetOperationEntity<OName> extends never ? false : GetOperationEntity<OName>,
> extends Omit<BaseTableProps<OEntity extends EntityTypes ? OEntity : object>, 'errorText' | 'items'> {
  readonly paginatedQuery: THookResult;
  readonly errorText?: string | ((error: any) => string | undefined);
  readonly keepPreviousData?: boolean;
}

export type ConstrainedPaginatedQueryResultTableProps<T extends ApiPaginatedOperationName> = Omit<
  PaginatedQueryResultTableProps<T>,
  'paginatedQuery' | 'columnDefinitions'
>;

export const PaginatedQueryResultTable = <T extends ApiPaginatedOperationName>({
  paginatedQuery,
  errorText: errorTextProp,
  keepPreviousData = true,
  ...props
}: PaginatedQueryResultTableProps<T>) => {
  const { LL } = useI18nContext();

  const { pageCount, hasNextPage, isFetchingNextPage, isFetching } = paginatedQuery;
  const paginatedQueryRef = useStatefulRef(paginatedQuery);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const pages = paginatedQuery.data?.pages;
  const defaultPageSize = props.defaultPageSize;

  const [items, setItems] = useState<any[]>();
  const [previousItems, setPreviousItems] = useState<any[]>();
  useEffect(() => {
    setItems((currentItems) => {
      setPreviousItems(currentItems);

      if (pageIndex === -1 || pages == null || isEmpty(pages)) return undefined;
      return (pages[pageIndex] as any[]) || undefined;
    });
  }, [pages, pageIndex]);
  const totalItems = useMemo<number>((): number => {
    return (pages || []).reduce((_totalItems: number, page: any): number => {
      if (Array.isArray(page)) return _totalItems + page.length;
      return _totalItems;
    }, 0);
  }, [pages]);

  const onFetchData = useCallback(
    (options: FetchDataOptions) => {
      const _pageIndex = options.pageIndex || 0;
      setPageIndex(_pageIndex);
      if (_pageIndex === 0) return; // ignore first page as React Query already handles that load

      // fetch requested page if not already loaded
      const { hasNextPage: _hasNextPage, fetchNextPage, data } = paginatedQueryRef.current;
      if (_pageIndex + 1 > (data?.pages?.length || 0) && _hasNextPage) {
        fetchNextPage();
      }
    },
    [paginatedQueryRef, defaultPageSize],
  );

  // TODO: create generic error handling for list table results
  const paginatedQueryError = paginatedQuery.error;
  const errorText = useMemo<string | undefined>(() => {
    if (paginatedQueryError == null) return undefined;

    if (errorTextProp) {
      if (typeof errorTextProp === 'function') {
        return errorTextProp(paginatedQueryError);
      }
      return errorTextProp;
    }

    if (paginatedQueryError.message) {
      return LL.VIEW.error.failedToFetchDetailed({ details: paginatedQueryError.message });
    }

    return LL.VIEW.error.failedToFetch();
  }, [errorTextProp, paginatedQueryError]);

  return (
    <ErrorBoundary>
      <BaseTable
        items={items || (keepPreviousData ? previousItems : undefined)}
        errorText={errorText}
        loading={isFetching || isFetchingNextPage}
        getRowId={paginatedQuery.getRowId as any}
        rowCount={pageCount === -1 ? -1 : totalItems} // TODO: once we have "totalItems" working in pagination we can remove this
        // rowCount={pageCount ? totalItems : -1} // TODO: once we have "totalItems" working in pagination we can remove this
        hasNextPage={hasNextPage}
        onFetchData={onFetchData}
        disableManual
        {...props}
      />
    </ErrorBoundary>
  );
};
