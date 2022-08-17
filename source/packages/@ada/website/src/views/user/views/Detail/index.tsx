/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ACCESS } from '$api/hooks/permissions';
import { ApiKeyTable } from '../../components/tables/ApiKeyTable';
import { Column, ManagedHelpPanel, Table } from '$northstar-plus';
import { ExpandableSection, StatusIndicator } from 'aws-northstar';
import { GroupLinkList } from '$common/entity/group/components/GroupLinkList';
import { SummaryRenderer } from '$northstar-plus/components/SummaryRenderer';
import { UserProfile, useFederatedUser } from '$common/entity/user';
import { apiHooks } from '$api';
import { featureFlag } from '$config';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useIsAdmin, useUserId, useUserProfile } from '$core/provider/UserProvider';
import { useParams } from 'react-router-dom';
import React, { useMemo } from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

const API_PERMISSIONS_ENABLED = featureFlag('API_PERMISSIONS_ENABLED');

function useUser(): UserProfile {
  const params = useParams<{ userId?: string }>();
  const currentUser = useUserProfile();
  const apiUser = useFederatedUser(params.userId);

  if (apiUser) return apiUser;
  return currentUser;
}

export interface UserDetailViewProps {}

export const UserDetailView: React.FC<UserDetailViewProps> = () => {
  const { LL } = useI18nContext();
  const user = useUser();
  const userId = user.id;
  const currentUserId = useUserId();
  const isCurrentUser = currentUserId === userId;
  const isAdmin = useIsAdmin();
  const showApiKeys = isCurrentUser || isAdmin;

  return (
    <>
      <HelpInfo />
      <SummaryRenderer
        sections={[
          {
            title: isCurrentUser ? LL.CONST.MY_PROFILE() : LL.ENTITY['User^'](user.name),
            subtitle: LL.ENTITY.UserProfile(),
            options: { columns: 3 },
            properties: [
              {
                label: LL.ENTITY['UserProfile@'].id.label(),
                value: user.id,
              },
              {
                label: LL.ENTITY['UserProfile@'].email.label(),
                value: user.email,
              },
            ],
          },
          {
            title: 'Permissions',
            properties: [
              {
                label: LL.ENTITY['UserProfile@'].groups.label(),
                value: <GroupLinkList groups={user.groups} />,
              },
            ],
          },
        ]}
      />
      {showApiKeys && <ApiKeyTable userId={userId} />}
      {API_PERMISSIONS_ENABLED && (isAdmin || isCurrentUser) && <Permissions cognitoUsername={user.cognitoUsername} />}
    </>
  );
};

interface RoutePermissions {
  route: string;
  access: ACCESS;
}

const Permissions: React.FC<{ cognitoUsername: string }> = ({ cognitoUsername }) => {
  const { LL } = useI18nContext();
  const [permissionsResponse] = apiHooks.usePermissionUser({ userId: cognitoUsername });
  const permissions = permissionsResponse?.permissions;

  const columnDefinitions = useMemo<Column<RoutePermissions>[]>(
    () => [
      {
        id: 'route',
        accessor: 'route',
        Header: LL.VIEW.USER.API_ACCESS.COLUMN.route.header(),
        width: 400,
      },
      {
        id: 'access',
        accessor: 'access',
        Header: LL.VIEW.USER.API_ACCESS.COLUMN.access.header(),
        width: 100,
        Cell: ({ value }) => (
          <StatusIndicator statusType={value === 'ALLOW' ? 'positive' : 'negative'}>{value}</StatusIndicator>
        ),
      },
    ],
    [],
  );

  const items = useMemo<RoutePermissions[]>(() => {
    return Object.entries(permissions || {}).map(([route, info]) => {
      return { route, access: info.access === true ? 'ALLOW' : 'DENY' };
    });
  }, [permissions]);

  return (
    <ExpandableSection header={LL.VIEW.USER.API_ACCESS.title()}>
      <Table
        defaultPageSize={1000}
        columnDefinitions={columnDefinitions}
        items={items}
        disablePagination
        disableRowSelect
        disableSettings
      />
    </ExpandableSection>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.USER.HELP.DETAIL.header()}>
      {import('@ada/strings/markdown/view/user/help.detail.md')}
    </ManagedHelpPanel>
  );
}
