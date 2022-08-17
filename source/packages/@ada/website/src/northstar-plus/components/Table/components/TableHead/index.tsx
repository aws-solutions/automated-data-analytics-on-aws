/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import {
  Column,
  ColumnInstance,
  HeaderGroup,
  HeaderPropGetter,
  UseFiltersColumnProps,
  UseResizeColumnsColumnProps,
  UseSortByColumnProps,
} from 'react-table';
import { SEARCH_COLUMN_NAME } from 'aws-northstar/components/Table/constants';
import { Stack } from 'aws-northstar/layouts';
import { isNil, omitBy } from 'lodash';
import ArrowDropDown from '@material-ui/icons/ArrowDropDown';
import BaseTableHead from '@material-ui/core/TableHead';
import React from 'react';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';

const headerProps: HeaderPropGetter<any> = (props, { column }) => {
  const align = (column as any).align;

  return [
    props,
    {
      style: omitBy(
        {
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          display: 'flex',
          flex: column.width === 0 ? 'none' : undefined,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        },
        isNil,
      ),
    },
  ];
};

export interface TableHeadProps<D extends object> {
  headerGroups: HeaderGroup<D>[];
  styles: {
    cellAlign: string;
    tableHeadRow: string;
    resizer: string;
  };
}

/* eslint-disable react/jsx-key */
export default function TableHead<D extends object>({ headerGroups, styles }: TableHeadProps<D>) {
  return (
    <BaseTableHead>
      {headerGroups.map((headerGroup: HeaderGroup<D>) => (
        <TableRow {...headerGroup.getHeaderGroupProps()} className={styles.tableHeadRow}>
          {headerGroup.headers.map(
            (
              column: Partial<
                ColumnInstance<D> &
                  Column<D> &
                  UseSortByColumnProps<D> &
                  UseResizeColumnsColumnProps<D> &
                  UseFiltersColumnProps<D>
              >,
            ) =>
              column.id !== SEARCH_COLUMN_NAME && (
                <TableCell {...column.getHeaderProps!(headerProps)}>
                  <Stack spacing="xs">
                    {column.canSort ? (
                      <TableSortLabel
                        {...column.getSortByToggleProps!()}
                        active={column.isSorted}
                        direction={(column.isSortedDesc && 'desc') || 'asc'}
                        IconComponent={ArrowDropDown}
                        className={styles.cellAlign}
                      >
                        <span>{column.render?.('Header')}</span>
                      </TableSortLabel>
                    ) : (
                      <span>{column.render?.('Header')}</span>
                    )}
                    <div>{column.canFilter ? column.render?.('Filter') : null}</div>
                    <div {...column.getResizerProps!()} className={styles.resizer} />
                  </Stack>
                </TableCell>
              ),
          )}
        </TableRow>
      ))}
    </BaseTableHead>
  );
}
