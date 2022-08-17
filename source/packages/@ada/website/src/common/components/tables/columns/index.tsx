/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CellProps } from 'react-table';
import { Column } from 'aws-northstar/components/Table';
import { Link, Theme, makeStyles } from 'aws-northstar';
import { RelativeDate } from '$northstar-plus/components/RelativeDate';
import { Tooltip } from '$northstar-plus/components/Tooltip';
import { createStyles } from '@material-ui/core';
import { pick } from 'lodash';
import Truncate, { TruncateProps } from 'react-truncate';
import type { CreateAndUpdateDetails } from '@ada/api';

export const CREATED_COLUMN: Column<CreateAndUpdateDetails> = {
  id: 'createdBy',
  accessor: 'createdBy',
  Header: 'Created',
  Cell: ({ row }) => {
    if (row.original.createdBy && row.original.createdTimestamp) {
      return <RelativeDate date={row.original.createdTimestamp} tooltip={`By ${row.original.createdBy}`} />;
    } else {
      return null;
    }
  },
};

export const UPDATED_COLUMN: Column<CreateAndUpdateDetails> = {
  id: 'updatedBy',
  accessor: 'updatedBy',
  Header: 'Updated',
  Cell: ({ row }) => {
    if (row.original.updatedTimestamp && row.original.updatedBy) {
      return <RelativeDate date={row.original.updatedTimestamp} tooltip={`By ${row.original.updatedBy}`} />;
    } else {
      return null;
    }
  },
};

export const ENTITY_COLUMNS: Column<CreateAndUpdateDetails>[] = [CREATED_COLUMN, UPDATED_COLUMN];

type CellTruncateProps<D extends object = any, V = any> = TruncateProps & CellProps<D, V>;

function cellTruncateWidth({ cell, ...props }: CellTruncateProps): number {
  return Math.max(cell.column.totalWidth, (cell.column as any).totalFlexWidth, props.totalColumnsWidth) - 20;
}

export const TruncatedCell: React.FC<CellTruncateProps> = (props) => {
  const { children, value, defaultValue } = props;
  const width = cellTruncateWidth(props);
  const classes = useTruncateStyles({ maxWidth: width });
  const truncateProps: TruncateProps = pick(props, [
    'lines',
    'ellipsis',
    'trimWhitespace',
    'onTruncate',
  ] as (keyof TruncateProps)[]);
  return (
    <Truncate {...truncateProps} width={width} className={classes.truncatedCell}>
      {children || value || defaultValue}
    </Truncate>
  );
};

export const TruncatedCellWithTooltip: React.FC<
  CellTruncateProps & { tooltipHeader?: string; tooltipContent?: string }
> = ({ tooltipHeader, tooltipContent, ...props }) => {
  const { value, defaultValue } = props;
  return (
    <Tooltip header={tooltipHeader} content={<span>{tooltipContent || value || defaultValue}</span>}>
      <TruncatedCell {...props}>{value || defaultValue}</TruncatedCell>
    </Tooltip>
  );
};

export const TruncatedCellLinkWithTooltip: React.FC<
  CellTruncateProps & { tooltipHeader?: string; tooltipContent?: string; link: string }
> = ({ link, ...props }) => {
  return (
    <Link href={link}>
      <TruncatedCellWithTooltip {...props} />
    </Link>
  );
};

const useTruncateStyles = makeStyles<Theme, { maxWidth: number }>(() =>
  createStyles({
    truncatedCell: {
      flex: 1,
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'row',
      maxWidth: ({ maxWidth }) => maxWidth,
      // TODO: jerjonas - polish the truncation with tooltip and links
      '& *': {
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        maxWidth: ({ maxWidth }) => maxWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      '& > span': {
        flex: 1,
        display: 'block',
        alignSelf: 'stretch',
      },
    },
  }),
);
