/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Skeletons } from '$northstar-plus';
import { FlexTable as Table, TableBaseOptions } from '$northstar-plus/components/Table';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES: number[] = [25, 50, 100, 500];

export const DEFAULT_TABLE_PROPS: any = {
  defaultPageSize: DEFAULT_PAGE_SIZE,
  pageSizes: PAGE_SIZES,
  disableRowSelect: true,
  wrapText: false,
  disableFilters: false,
  disableColumnFilters: true,
  disableExpand: true,
  autoGlobalFilter: true,
} as TableBaseOptions<object>;

export interface BaseTableProps<D extends object> extends TableBaseOptions<D> {
  /**
   * Items selector to filter the displayed items in table.
   */
  readonly selector?: (items: D[]) => D[];
  /**
   * Indicates if the table title should include total items count.
   * @default true
   */
  readonly tableTitleCount?: boolean;

  /** Disables vertical scrolling */
  readonly preventVerticalScroll?: boolean;

  /** Indicates that entire table will be hidden if empty */
  readonly hideEmptyTable?: boolean;
}

export const BaseTable = <D extends object>({
  selector,
  tableTitle,
  tableTitleCount = true,
  items,
  preventVerticalScroll,
  hideEmptyTable,
  ...props
}: BaseTableProps<D>) => {
  const defaultPageSize = props.defaultPageSize || DEFAULT_PAGE_SIZE;
  const managedItems = useMemo(() => {
    if (items == null) return []; // IMPORTANT: must set default items other get "Error: Maximum update depth exceeded..."
    if (selector) {
      return selector(items);
    }
    return items;
  }, [JSON.stringify(items), selector]); // eslint-disable-line react-hooks/exhaustive-deps

  const managedTitle = useMemo(() => {
    if (tableTitle == null) return undefined;
    if (tableTitleCount && managedItems?.length) {
      return `${tableTitle} (${managedItems.length})`;
    }
    return tableTitle;
  }, [tableTitle, tableTitleCount, managedItems]);

  const _initialLoading = isEmpty(items) && props.loading;
  const [isInitialLoading, setIsInitialLoading] = useState(_initialLoading);
  useEffect(() => {
    if (_initialLoading === false) {
      setIsInitialLoading(false);
    }
  }, [_initialLoading]);

  if (hideEmptyTable && isEmpty(managedItems)) {
    return null;
  }

  if (isInitialLoading) {
    return <Skeletons.Table tableTitle={managedTitle} tableDescription={props.tableDescription} />;
  }

  return (
    <Table
      {...DEFAULT_TABLE_PROPS}
      {...props}
      items={managedItems}
      defaultPageSize={props.disablePagination ? Math.max(managedItems.length, defaultPageSize) : props.defaultPageSize}
      tableTitle={managedTitle}
      maxHeight={preventVerticalScroll ? 'initial' : undefined}
      // disable column sorting for onFetchData
      disableSortBy={props.disableSortBy != null ? props.disableSortBy : props.onFetchData != null}
    />
  );
};

export { BaseTable as FlexTable };
