/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseTable, BaseTableProps } from '$common/components/tables/BaseTable';
import { Column } from 'aws-northstar/components/Table';
import { InlineAddMembers } from './InlineAddMembers';
import { UserLink, UserProfile, useFederatedUsers } from '../../../common/entity/user';
import { apiHooks } from '$api';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useMemo } from 'react';

export interface GroupMemberTableProps extends Omit<BaseTableProps<Member>, 'columnDefinitions' | 'items'> {
  readonly groupId: string;
}

type Member = Partial<UserProfile>;

export const GroupMemberTable: React.FC<GroupMemberTableProps> = ({ groupId, selector: _selector, ...props }) => {
  const { LL } = useI18nContext();
  const [group, { refetch }] = apiHooks.useIdentityGroup({ groupId });
  const canEdit = useUserCanModifyEntity(group, { operation: 'putIdentityGroup', allowSystem: true });

  const allUsers = useFederatedUsers();

  const items = useMemo<Member[]>(() => {
    return (
      group?.members.map((_member) => {
        const user = (allUsers || []).find((_user) => _user.id === _member);
        return user || { id: _member, name: _member };
      }) || []
    );
  }, [group?.members, allUsers]);

  const columnDefinitions: Column<Member>[] = useMemo(
    () => [
      {
        id: 'id',
        accessor: 'id',
        Header: LL.VIEW.GROUP.TABLES.MEMBER.COLUMN.id.header(),
        width: 0.5,
        Cell: ({ value }) => <UserLink user={value} />,
      },
      {
        id: 'name',
        accessor: 'name',
        Header: LL.VIEW.GROUP.TABLES.MEMBER.COLUMN.name.header(),
      },
    ],
    [],
  );

  return (
    <BaseTable
      columnDefinitions={columnDefinitions as any}
      items={items as any}
      actionGroup={canEdit && <InlineAddMembers groupId={groupId} onAdded={() => refetch({ force: true })} />}
      {...props}
    />
  );
};
