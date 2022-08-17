/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Cell, CellPropGetter, TableBodyProps as ReactTableBodyProps, UseGroupByCellProps } from 'react-table';
import { Row } from 'aws-northstar/components/Table/types';
import { isNil, omitBy } from 'lodash';
import BaseTableBody from '@material-ui/core/TableBody';
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';
import React from 'react';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import clsx from 'clsx';

const cellProps: CellPropGetter<any> = (props, { cell }) => {
  const align = (cell.column as any).align;

  return [
    props,
    {
      style: omitBy(
        {
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          display: 'flex',
          flex: cell.column.width === 0 ? 'none' : undefined,
          minWidth: cell.column.minWidth,
          maxWidth: cell.column.maxWidth,
        },
        isNil,
      ),
    },
  ];
};

export interface TableBodyProps<D extends object> {
  reactTableBodyProps: ReactTableBodyProps;
  page: Row<D>[];
  wrapText?: boolean;
  prepareRow: (row: Row<D>) => void;
  styles: {
    cellAlign: string;
    ellipsizeText: string;
    aggregated: string;
  };
}

/* eslint-disable react/jsx-key */
export default function TableBody<D extends object>({
  page,
  prepareRow,
  wrapText = true,
  reactTableBodyProps,
  styles,
}: TableBodyProps<D>) {
  return (
    <BaseTableBody {...reactTableBodyProps}>
      {page
        .map((row: Row<D>) => {
          prepareRow(row);
          return row;
        })
        .map((row: Row<D>) => (
          <TableRow
            selected={row.isSelected}
            {...row.getRowProps()}
            className={clsx({ [styles.aggregated]: row.isGrouped })}
          >
            {row.cells.map((cell: Partial<Cell<D> & UseGroupByCellProps<D>>) => {
              return (
                <TableCell {...cell.getCellProps!(cellProps)}>
                  {cell.isGrouped ? (
                    <div className={styles.cellAlign}>
                      <span className={clsx({ [styles.ellipsizeText]: !wrapText })}>
                        <b>
                          {cell.render!('Cell')} ({row.subRows.length})
                        </b>
                      </span>
                      <GroupedRowExpander row={row} />
                    </div>
                  ) : (
                    // If the cell is aggregated, use the Aggregated
                    // renderer for cell, otherwise, just render the regular cell
                    <div className={clsx({ [styles.ellipsizeText]: !wrapText })}>
                      {cell.render!((cell.isAggregated && 'Aggregated') || 'Cell')}
                    </div>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
    </BaseTableBody>
  );
}

const GroupedRowExpander: React.FC<{ row: Row<any> }> = ({ row }) => {
  if (row.isExpanded) {
    return <KeyboardArrowDown {...row.getToggleRowExpandedProps!()} />
  }
  return <KeyboardArrowRight {...row.getToggleRowExpandedProps!()} />
}
