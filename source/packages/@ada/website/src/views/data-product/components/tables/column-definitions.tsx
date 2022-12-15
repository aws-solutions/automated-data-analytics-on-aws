/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Column } from 'aws-northstar/components/Table';
import { DataProductEntity } from '@ada/api-client';
import { ENTITY_COLUMNS, TruncatedCellLinkWithTooltip } from '$common/components/tables/columns';
import { KeyValuePairStack } from '$northstar-plus';
import { LL } from '$strings';
import { SourceTypeBadge } from '$connectors/icons';
import { Status } from '../Status';
import { UserLink } from '$common/entity/user';
import { getDataProductSQLIdentitier } from '$common/utils/data-product';
import { getDataProductState } from '../../common';

export const columnDefinitions: Column<DataProductEntity>[] = [
  {
    id: 'name',
    accessor: 'name',
    Header: LL.ENTITY['DataProduct@'].name.label(),
    minWidth: 80,
    Cell: (props) => {
      const { name, description } = props.row.original;
      return (
        <TruncatedCellLinkWithTooltip
          {...(props as any)}
          tooltipHeader={LL.ENTITY.DataProduct()}
          tooltipContent={
            <KeyValuePairStack
              spacing="xs"
              properties={{
                name,
                description,
                [LL.ENTITY.SqlIdentifier.label()]: getDataProductSQLIdentitier(props.row.original),
              }}
            />
          }
          value={props.row.original.name}
          link={`/data-product/${props.row.original.domainId}/${props.row.original.dataProductId}`}
        />
      );
    },
  },
  {
    id: 'status',
    accessor: 'infrastructureStatus',
    Header: LL.ENTITY.DataProduct_.status.label(),
    minWidth: 60,
    Cell: ({ row }) => <Status {...getDataProductState(row.original)} />,
  },
  {
    id: 'sourceType',
    accessor: 'sourceType',
    Header: LL.ENTITY['DataProduct@'].sourceType.label(),
    minWidth: 60,
    Cell: ({ value }) => <SourceTypeBadge sourceType={value} />,
  },
  {
    id: 'owner',
    accessor: 'createdBy',
    Header: LL.CONST.OWNER(),
    Cell: ({ value }) => <UserLink user={value} noTooltip />,
  },
  ...(ENTITY_COLUMNS as Column<DataProductEntity>[]),
  // {
  //   id: 'description',
  //   accessor: 'description',
  //   Header: 'Description',
  //   Cell: TruncatedCellWithTooltip,
  // },
];

export const columnDefinitionsWithDomain: Column<DataProductEntity>[] = [
  {
    id: 'domainId',
    accessor: 'domainId',
    Header: LL.ENTITY.Domain(),
    Cell: (props) => (
      <TruncatedCellLinkWithTooltip {...(props as any)} link={`/data-product/${props.row.original.domainId}`} />
    ),
  },
  ...columnDefinitions,
];
