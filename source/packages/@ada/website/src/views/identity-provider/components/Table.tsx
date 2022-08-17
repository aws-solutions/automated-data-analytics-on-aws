/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AllQueryResultTable, ConstrainedAllQueryResultTableProps } from '$common/components/tables';
import { Column } from 'aws-northstar/components/Table';
import { ENTITY_COLUMNS } from '$common/components/tables/columns';
import { IdentityProviderEntity } from '@ada/api';
import { LL } from '@ada/strings';
import { Link, StatusIndicator } from 'aws-northstar';
import { apiHooks } from '$api';
import React from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

const columnDefinitions: Column<IdentityProviderEntity>[] = [
  {
    id: 'identityProviderId',
    accessor: 'identityProviderId',
    Header: LL.ENTITY['IdentityProvider@'].identityProviderId.label(),
    Cell: ({ value }) => <Link href={`/admin/identity/provider/${value}`}>{value}</Link>,
  },
  {
    id: 'type',
    accessor: 'type',
    Header: LL.ENTITY['IdentityProvider@'].type.label(),
  },
  {
    id: 'name',
    accessor: 'name',
    Header: LL.ENTITY['IdentityProvider@'].name.label(),
  },
  {
    id: 'enabled',
    accessor: 'enabled',
    Header: LL.VIEW.IDENTITY_PROVIDER.STATUS.label(),
    width: 160,
    Cell: ({ row }) => {
      if (row && row.original) {
        const status = row.original.enabled;
        switch (status) {
          case true:
            return <StatusIndicator statusType="positive">{LL.VIEW.IDENTITY_PROVIDER.STATUS.enabled()}</StatusIndicator>;
          case false:
            return <StatusIndicator statusType="negative">{LL.VIEW.IDENTITY_PROVIDER.STATUS.disabled()}</StatusIndicator>;
          default:
            return null;
        }
      }
      return row.id;
    },
  },
  {
    id: 'description',
    accessor: 'description',
    Header: LL.ENTITY['IdentityProvider@'].description.label(),
  },
  ...(ENTITY_COLUMNS as Column<IdentityProviderEntity>[]),
];

export type IdentityProviderTableProps = ConstrainedAllQueryResultTableProps<'listIdentityProviders'>;

export const IdentityProviderTable: React.FC<IdentityProviderTableProps> = (props) => {
  const allQueryResult = apiHooks.useAllIdentityProviders();

  return (
    <AllQueryResultTable<'listIdentityProviders'>
      tableTitle={LL.ENTITY.IdentityProviders()}
      columnDefinitions={columnDefinitions}
      allQueryResult={allQueryResult}
      {...props}
    />
  );
};
