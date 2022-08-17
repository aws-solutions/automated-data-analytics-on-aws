/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseTable, BaseTableProps } from '$common/components/tables';
import { Column } from 'aws-northstar/components/Table';
import { GroupLinkList } from '$common/entity/group';
import { UserLink, UserProfile, useFederatedUsers } from '$common/entity/user';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useMemo } from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

export type UserTableProps = Omit<BaseTableProps<UserProfile>, 'columnDefinitions' | 'items'>;

export const UserTable: React.FC<UserTableProps> = ({ selector: _selector, ...props }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const users = useFederatedUsers();

  const columnDefinitions: Column<UserProfile>[] = useMemo(
    () => [
      {
        id: 'id',
        accessor: 'id',
        width: 0.5,
        Header: LL.ENTITY['UserProfile@'].id.label(),
        Cell: ({ value }) => <UserLink user={value} />,
      },
      {
        id: 'name',
        accessor: 'name',
        Header: LL.ENTITY['UserProfile@'].name.label(),
        width: 0.25,
      },
      {
        id: 'email',
        accessor: 'email',
        Header: LL.ENTITY['UserProfile@'].email.label(),
        width: 0.25,
      },
      {
        id: 'groups',
        accessor: 'groups',
        width: 2,
        Header: LL.ENTITY['UserProfile@'].groups.label(),
        Cell: ({ value }) => <GroupLinkList groups={value} />,
      },
    ],
    [history],
  );

  return (
    <>
      <BaseTable
        tableTitle="Users"
        tableDescription="List of users that have accessed the application"
        columnDefinitions={columnDefinitions as any}
        items={users}
        disablePagination
        disableColumnFilters
        disableSettings
        disableFilters
        {...props}
      />
    </>
  );
};
