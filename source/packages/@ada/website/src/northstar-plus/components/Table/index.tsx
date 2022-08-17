/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import {
  IdType,
  PluginHook,
  Row,
  UseGroupByRowProps,
  UseTableOptions,
  useBlockLayout,
  useExpanded,
  useFilters,
  useFlexLayout,
  useGlobalFilter,
  useGroupBy,
  usePagination,
  useResizeColumns,
  useRowSelect,
  useSortBy,
  useTable,
} from 'react-table';
import { makeStyles } from '@material-ui/core/styles';
import { useDebouncedCallback } from 'use-debounce';
import BaseTable from '@material-ui/core/Table';
import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import {
  TableBaseOptions as BaseTableBaseOptions,
  BooleanObject,
  Column,
  FetchDataOptions,
  TableInstance,
  TableOptions,
} from 'aws-northstar/components/Table/types';
import {
  DEFAULT_DEBOUNCE_TIMER,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZES,
} from 'aws-northstar/components/Table/constants';
import {
  convertArrayToBooleanObject,
  convertBooleanObjectToArray,
} from 'aws-northstar/components/Table/utils/converter';
import ColumnsGrouping from 'aws-northstar/components/Table/components/ColumnsGrouping';
import ColumnsSelector from 'aws-northstar/components/Table/components/ColumnsSelector';
import Container from 'aws-northstar/layouts/Container';
import ContainerHeaderContent, {
  ContainerHeaderContentProps,
} from 'aws-northstar/components/Table/components/ContainerHeaderContent';
import DefaultColumnFilter from 'aws-northstar/components/Table/components/DefaultColumnFilter';
import TableFooter from 'aws-northstar/components/Table/components/TableFooter';
import useTableColumnFilter from 'aws-northstar/components/Table/hooks/useTableColumnFilter';
// overrides
import SettingsBar from './components/SettingsBar';
import TableBody from './components/TableBody';
import TableHead from './components/TableHead';

/**
 * Changes: @jerjonas
 * - enable passing additional "plugins"
 * - add FlexTable via "plugins" above
 * - enable infinite pagination / unknown pages (set `rowCount: Infinite` and control with `hasNextPage`)
 */
interface TableBaseOptions<D extends object> extends BaseTableBaseOptions<D> {
  plugins?: PluginHook<D>[];
  hasNextPage?: boolean;
  disableManual?: boolean;
  maxHeight?: CSSProperties['maxHeight'];
  onPageSizeChange?: (pageSize: number) => void;
  showRowNumber?: boolean;
  testid?: string;

  // CHANGE: jerjonas
  /**
   * Indicates if automatic global filtering is enabled.
   * This flag enbables providing automatic global filtering while also supplying data via `onFetchData` functionality.
   *
   * @default Based on `onFetchData`; `false` if `onFetchData != null`, otherwise `true`
   *
   */
  autoGlobalFilter?: boolean;
}

/**
 * A table presents data in a two-dimensional format, arranged in columns and rows in a rectangular form.
 * */
export function Table<D extends object>({
  actionGroup = null,
  columnDefinitions: columnDefinitionsProp = [],
  defaultGroups = [],
  defaultColumnFilter = DefaultColumnFilter,
  defaultPageIndex = 0,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  disableGroupBy = true,
  disableExpand = true,
  disableColumnFilters = true,
  disablePagination = false,
  disableSettings = false,
  disableSortBy = false,
  disableFilters = false,
  disableRowSelect = false,
  items = [],
  loading = false,
  onSelectionChange,
  onFetchData = null,
  pageSizes = DEFAULT_PAGE_SIZES,
  tableDescription,
  tableTitle = '',
  wrapText = true,
  selectedRowIds: initialSelectedRowIds = [],
  multiSelect = true,
  getRowId,
  getSubRows,
  isItemDisabled,
  errorText,
  onSelectedRowIdsChange,
  sortBy: defaultSortBy = [],

  // changes
  plugins: additionalPlugins,
  hasNextPage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disableManual, //NOSONAR (S1172:Unused Function Parameter) - ignore
  maxHeight,
  onPageSizeChange,
  showRowNumber,
  testid,
  autoGlobalFilter,
  ...props
}: TableBaseOptions<D>) {
  const styles = useStyles({});
  const [groupBy, setGroupBy] = useState(convertArrayToBooleanObject(defaultGroups));
  const columnDefinitions = useMemo(() => {
    if (showRowNumber) {
      return [ROWNUM_COLUMN as Column<D>].concat(columnDefinitionsProp);
    }
    return columnDefinitionsProp;
  }, [columnDefinitionsProp, showRowNumber]);
  const [showColumns, setShowColumns] = useState<BooleanObject>(
    convertArrayToBooleanObject(columnDefinitions.map((column: Column<D>) => column.id || '')),
  );

  const selectedRowIdMap = useMemo(() => convertArrayToBooleanObject(initialSelectedRowIds), [initialSelectedRowIds]);

  const [controlledPageSize, setControlledPageSize] = useState(defaultPageSize);

  const columns = useTableColumnFilter({
    columnDefinitions,
    showColumns,
    disableRowSelect,
    disableExpand,
    multiSelect,
    isItemDisabled,
  });

  const rowCount = useMemo(() => {
    if (typeof props.rowCount === 'undefined') {
      return items?.length || 0;
    }

    return props.rowCount;
  }, [items, props.rowCount]);

  const pageCount = useMemo(() => {
    // CHANGE: preserve `-1` value for manual pagination
    // https://react-table.tanstack.com/docs/api/usePagination#table-options
    if (rowCount === -1) return -1;

    return Math.ceil(rowCount / controlledPageSize);
  }, [rowCount, controlledPageSize]);

  // CHANGE: enable forcing automatic even when `onFetchData` is defined
  const manual = onFetchData != null;
  const globalFilters = autoGlobalFilter != null ? autoGlobalFilter : !manual;

  const tableOpts: TableOptions<D> & UseTableOptions<D> = useMemo(
    () => ({
      data: items || [],
      columns,
      defaultColumn: {
        minWidth: 50,
        width: 120,
        maxWidth: 800,
        Filter: !disableColumnFilters && defaultColumnFilter,
      },
      initialState: {
        pageIndex: defaultPageIndex,
        pageSize: controlledPageSize,
        selectedRowIds: selectedRowIdMap,
        sortBy: defaultSortBy,
        groupBy: defaultGroups,
      },
      ...(onFetchData != null && { pageCount }),
      getRowId,
      getSubRows,
      disableSortBy,
      disableGroupBy,
      disableFilters: disableColumnFilters,
      manualFilters: !globalFilters, // CHANGED - jerjonas
      manualPagination: manual,
      manualSorting: manual,
      manualSortBy: manual,
      // CHANGE: jerjonas - add override to enable global filtering even when onFetchData is provided
      manualGlobalFilter: !globalFilters,
      autoResetSortBy: !manual,
      autoResetPage: !manual,
      autoResetSelectedRows: !manual,
      autoResetFilters: !manual,
      autoResetGlobalFilter: !manual,
    }),
    [
      items,
      columns,
      pageCount,
      controlledPageSize,
      defaultColumnFilter,
      defaultGroups,
      defaultPageIndex,
      defaultSortBy,
      disableColumnFilters,
      disableGroupBy,
      disableSortBy,
      getRowId,
      getSubRows,
      onFetchData,
      selectedRowIdMap,
    ],
  );

  const plugins = useMemo(() => {
    const _plugins: PluginHook<D>[] = [
      useBlockLayout,
      useFilters,
      useGlobalFilter,
      useGroupBy,
      useSortBy,
      useExpanded,
      usePagination,
      useRowSelect,
      useResizeColumns,
    ];
    if (additionalPlugins) {
      _plugins.push(...additionalPlugins);
      if (additionalPlugins.includes(useFlexLayout)) {
        _plugins.shift(); // drop blockLayout when using flex layout
      }
    }

    return _plugins;
  }, []);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    rows,
    gotoPage,
    nextPage,
    canNextPage,
    previousPage,
    canPreviousPage,
    setPageSize,
    selectedFlatRows,
    setGlobalFilter,
    toggleGroupBy,
    state: { pageIndex, pageSize, sortBy, globalFilter, selectedRowIds },
  }: TableInstance<D> = useTable(tableOpts, ...plugins);

  useEffect(() => {
    setControlledPageSize(pageSize || DEFAULT_PAGE_SIZE);
    onPageSizeChange && onPageSizeChange(pageSize || DEFAULT_PAGE_SIZE);
  }, [pageSize]);

  const toggleCopy = (target: object, headerId: string) => {
    const copy: any = { ...target };

    if (copy[headerId]) {
      delete copy[headerId];
    } else {
      copy[headerId] = true;
    }

    return copy;
  };

  const handleShowColumnsChange = useCallback(
    (headerId?: IdType<string> | string) => {
      if (!headerId) {
        return;
      }

      const showColumnsCopy = toggleCopy(showColumns, headerId);

      setShowColumns(showColumnsCopy);
    },
    [showColumns, setShowColumns],
  );

  const onGroupChange = useCallback(
    (headerId?: IdType<string> | string) => {
      if (!headerId) {
        return;
      }

      const groupByCopy = toggleCopy(groupBy, headerId);

      setGroupBy(groupByCopy);
      toggleGroupBy!(headerId);
    },
    [groupBy, setGroupBy, toggleGroupBy],
  );

  const handleSelectionChangeDebounce = useDebouncedCallback((_selectedFlatRows: Row<D>[]) => {
    const selected = _selectedFlatRows
      .filter((row: Row<D> & Partial<UseGroupByRowProps<D>>) => !row.isGrouped)
      .map((row: Row<D>) => row.original);

    onSelectionChange?.(selected);
  }, DEFAULT_DEBOUNCE_TIMER);

  useEffect(() => {
    if (selectedFlatRows) {
      handleSelectionChangeDebounce(selectedFlatRows);
    }
  }, [selectedFlatRows, handleSelectionChangeDebounce]);

  useEffect(() => {
    selectedRowIds && onSelectedRowIdsChange?.(convertBooleanObjectToArray(selectedRowIds) || []);
  }, [selectedRowIds, onSelectedRowIdsChange]);

  useEffect(() => {
    if (onFetchData) {
      const flattenGroupBy = () => Object.keys(groupBy).filter((key) => groupBy[key]);
      const flattenShowColumns = () => Object.keys(showColumns).filter((key) => showColumns[key]);
      onFetchData({
        pageSize: pageSize || 0,
        pageIndex: pageIndex || 0,
        sortBy: sortBy || [],
        groupBy: flattenGroupBy(),
        showColumns: flattenShowColumns(),
        filterText: globalFilter || '',
      });
    }
  }, [onFetchData, pageIndex, pageSize, sortBy, groupBy, showColumns, globalFilter]);

  const columnsSelectorProps = {
    columnDefinitions,
    onShowColumnsChange: handleShowColumnsChange,
    showColumns,
    styles,
  };

  const columnsGroupingProps = {
    columnDefinitions,
    onGroupChange,
    groupBy,
    styles,
  };

  const groupCount = useMemo(() => {
    return rows.filter((row: Row<D> & Partial<UseGroupByRowProps<D>>) => row.isGrouped).length;
  }, [rows]);

  const settingsBarProps = {
    pageIndex: pageIndex || 0,
    pageSize: pageSize || DEFAULT_PAGE_SIZE,
    pageSizes: pageSizes || DEFAULT_PAGE_SIZES,
    pageLength: (page || []).length,
    // CHANGE: preserve -1 row count value to unknown pagination
    rowCount: rowCount === -1 ? -1 : rows.length,
    totalCount: rowCount === -1 ? -1 : rowCount + groupCount,
    loading,
    disablePagination,
    disableSettings,
    disableGroupBy,
    gotoPage,
    previousPage,
    canPreviousPage,
    nextPage,
    // CHANGE: enable manually handling next page
    canNextPage: canNextPage || hasNextPage,
    setPageSize,
    styles,
    columnsGroupingComponent: <ColumnsGrouping {...columnsGroupingProps} />,
    columnsSelectorComponent: <ColumnsSelector {...columnsSelectorProps} />,
  };

  const containerHeaderContentProps: ContainerHeaderContentProps = {
    disableFilters,
    loading,
    setGlobalFilter,
    globalFilter,
    styles,
    settingsBarComponent: <SettingsBar {...settingsBarProps} />,
  };

  const containerProps = {
    actionGroup,
    gutters: false,
    title: tableTitle,
    subtitle: tableDescription,
    headerContent:
      disableFilters && disableSettings && disablePagination ? null : (
        <ContainerHeaderContent {...containerHeaderContentProps} />
      ),
  };

  const tableHeadProps = {
    headerGroups,
    styles,
  };

  const tableBodyProps = {
    reactTableBodyProps: getTableBodyProps(),
    page: page || [],
    wrapText,
    prepareRow,
    styles,
  };

  const tableFooterProps = {
    errorText,
    loading,
    styles,
    colSpan: columns.length,
    pageLength: page?.length,
  };

  // CHANGE: ideally is in the useStyle classes, but downstream component types are failing typechecks
  const tableWrapperStyleOverrides = useMemo(() => {
    if (maxHeight == null) return undefined;
    return { maxHeight };
  }, [maxHeight]);

  return (
    <Container {...containerProps}>
      <div className={styles.tableWrapper} style={tableWrapperStyleOverrides} data-testid={testid}>
        <BaseTable {...getTableProps()} size="small" className={clsx({ [styles.loadingTableBlur]: loading })}>
          <TableHead {...tableHeadProps} />
          <TableBody {...tableBodyProps} />
          <TableFooter {...tableFooterProps} />
        </BaseTable>
      </div>
    </Container>
  );
}

export default Table;

export type { CellProps, SortingRule } from 'react-table';

export type { Column, Row, TableOptions, FetchDataOptions, TableBaseOptions };

export function FlexTable<D extends object>({ plugins = [], ...props }: TableBaseOptions<D>) {
  return <Table plugins={(plugins || []).concat([useFlexLayout])} {...props} />;
}

export const ROWNUM_COLUMN: Column<object> = {
  Header: '#',
  id: Symbol('ROWNUM_COLUMN').toString(),
  maxWidth: 20,
  width: 0, // no flex
  Cell: ({ row, state }: any) => {
    let num = row.index + 1;
    if (state.pageIndex != null && state.pageSize != null) {
      num = state.pageIndex * state.pageSize + (row.index + 1);
    }
    return <span style={{ opacity: 0.5 }}>{num}</span>;
  },
};

const useStyles = makeStyles((theme) => ({
  tableBar: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '.5rem',
  },
  tableWrapper: {
    maxHeight: '75vh',
  },
  searchBar: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    marginRight: '10px',
  },
  leftSpace: {
    marginLeft: '10px',
  },
  tableHeadRow: {
    borderTop: 0,
  },
  cellAlign: {
    display: 'inline-flex',
    alignItems: 'flex-end',
    width: 'inherit',
    height: 'max-content',
  },
  loadingTableBlur: {
    filter: 'alpha(opacity=50)',
    opacity: 0.5,
    transition: 'all 0.15s linear',
  },
  loadingSearchBarPadding: {
    paddingRight: '.25rem',
  },
  aggregated: {
    backgroundColor: theme.palette.grey[100],
  },
  verticalGrid: {
    display: 'inline-grid',
  },
  footerCell: {
    textAlign: 'center',
    fontWeight: 700,
    padding: '.5rem',
  },
  ellipsizeText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resizer: {
    display: 'inline-block',
    borderLeft: `1px solid ${theme.palette.grey[200]}`,
    width: '1px',
    height: '60%',
    position: 'absolute',
    right: 0,
    top: '20%',
    transform: 'translateX(50%)',
    zIndex: 1,
  },
}));
