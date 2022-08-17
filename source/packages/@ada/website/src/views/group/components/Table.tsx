/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import {
  AllQueryResultTable,
  ConstrainedAllQueryResultTableProps,
  TruncatedCellWithTooltip,
} from '$common/components/tables';
import { Button, Inline, Link, StatusIndicator } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { GroupEntity } from '@ada/api';
import { apiHooks } from '$api';
import { sortApiAccessPolicyIds } from '$common/entity/api-access-policy';
import { useAmplifyContext } from '$core/provider/AmplifyProvider';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '$northstar-plus';
import { useUserProfile } from '$core/provider/UserProvider';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import startCase from 'lodash/startCase';

export interface GroupTableProps extends ConstrainedAllQueryResultTableProps<'listIdentityGroups'> {
  variant?: 'system';
}

export const GroupTable: React.FC<GroupTableProps> = ({ selector, variant, ...props }) => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();
  const userProfile = useUserProfile();
  const { refreshToken } = useAmplifyContext();

  const [apiAccessPolicies] = apiHooks.useApiAccessPolicies();
  const getApiAccessPolicyName = useCallback(
    (id: string): string => {
      if (apiAccessPolicies == null) return startCase(id);
      return apiAccessPolicies.find((policy) => policy.apiAccessPolicyId === id)?.name || startCase(id);
    },
    [apiAccessPolicies],
  );

  const allQueryResult = apiHooks.useAllIdentityGroups(
    {},
    { select: selector, refetchInterval: POLLING.GROUP_MEMBERSHIP },
  );

  const [identityRequests, { refetch: refetchRequests }] = apiHooks.useAllIdentityRequests({}, {});

  const [processingGroups, setProcessingGroups] = useState<string[]>([]);
  const [localPendingGroups, setLocalPendingGroups] = useState<string[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  useEffect(() => {
    setIsSyncing(false);
  }, [userProfile]);
  const sync = useCallback(() => {
    setIsSyncing(true);
    refreshToken(true); // force
  }, [refreshToken]);

  const pendingGroups = useMemo(() => {
    if (identityRequests == null) return [];
    return identityRequests
      .filter((accessRequest) => accessRequest.userId === userProfile.id)
      .map((request) => request.groupId)
      .concat(localPendingGroups);
  }, [identityRequests, localPendingGroups, userProfile]);

  const [putIdentityRequest] = apiHooks.usePutIdentityRequest({
    onError: (error, variables) => {
      addError({
        header: LL.VIEW.GROUP.AccessRequest.notify.send.failed({ group: variables.groupId }),
        content: error.message,
      });
    },
    onSuccess: ({ groupId }) => {
      setLocalPendingGroups((current) => current.concat([groupId]));
      refetchRequests({ force: true });
      addSuccess({
        header: LL.VIEW.GROUP.AccessRequest.notify.send.header(),
        content: LL.VIEW.GROUP.AccessRequest.notify.send.content({ group: groupId }),
      });
    },
  });

  const sendJoinRequest = useCallback(
    (groupId: string) => {
      setProcessingGroups((current) => current.concat([groupId]));
      putIdentityRequest({
        groupId,
        userId: userProfile.id,
        accessRequestInput: {
          message: LL.ENTITY.AccessRequest_.ACTIONS.requestorMessage({ requestor: userProfile.name, group: groupId }),
        },
      });
    },
    [userProfile, putIdentityRequest],
  );

  const renderStatus = useCallback(
    ({ groupId, members, autoAssignUsers }: GroupEntity) => {
      if (autoAssignUsers || userProfile.groups.includes(groupId)) {
        return <StatusIndicator statusType="positive">{LL.ENTITY.Member()}</StatusIndicator>;
      }
      if (members.includes(userProfile.id)) {
        return (
          <Button
            size="small"
            onClick={sync}
            disabled={isSyncing}
            loading={isSyncing}
            label={LL.VIEW.GROUP.AccessRequest.ACTIONS.sync.label()}
          >
            {LL.VIEW.GROUP.AccessRequest.ACTIONS.sync.text()}
          </Button>
        );
      }
      if (pendingGroups.includes(groupId)) {
        return <StatusIndicator statusType="info">{LL.ENTITY.AccessRequest_.pending.label()}</StatusIndicator>;
      } else {
        const isProcessing = processingGroups.includes(groupId);
        return (
          <Button
            size="small"
            disabled={isProcessing}
            loading={isProcessing}
            onClick={isProcessing ? undefined : () => sendJoinRequest(groupId)}
            label={LL.VIEW.GROUP.AccessRequest.ACTIONS.join.label({ group: groupId })}
          >
            {LL.VIEW.GROUP.AccessRequest.ACTIONS.join.text()}
          </Button>
        );
      }
    },
    [userProfile, pendingGroups, processingGroups, refreshToken, sendJoinRequest, isSyncing, sync],
  );

  const columnDefinitions: Column<GroupEntity>[] = useMemo(
    () => [
      {
        id: 'groupId',
        accessor: 'groupId',
        Header: LL.ENTITY.Group(),
        width: 0.3,
        maxWidth: 200,
        Cell: ({ value }) => <Link href={`/groups/${value}`}>{startCase(value)}</Link>,
      },
      {
        id: 'description',
        accessor: 'description',
        Header: LL.ENTITY['Group@'].description.label(),
        width: 0.4,
        maxWidth: 200,
        Cell: TruncatedCellWithTooltip,
      },
      {
        id: 'members',
        accessor: 'members',
        Header: LL.ENTITY['Group@'].members.label(),
        width: 0.5,
        Cell: (_props) =>
          _props.row.original.autoAssignUsers ? (
            <StatusIndicator statusType="warning">All users</StatusIndicator>
          ) : (
            <TruncatedCellWithTooltip {...(_props as any)} value={(_props.value || []).join(', ')} />
          ),
      },
      {
        id: 'apiAccessPolicyIds',
        accessor: 'apiAccessPolicyIds',
        Header: LL.ENTITY['Group@'].accessPolicies.label(),
        width: 1,
        minWidth: 200,
        maxWidth: 200,
        Cell: ({ value }) => (
          <Inline>
            {value
              ? sortApiAccessPolicyIds(value).map((id: string, i) => <li key={i}>{getApiAccessPolicyName(id)}</li>)
              : null}
          </Inline>
        ),
      },
      {
        id: 'status',
        Header: LL.VIEW.GROUP.TABLES.GROUP.COLUMN.status.header(),
        width: 1,
        align: 'right',
        Cell: ({ row }: any) => renderStatus(row.original),
      },
    ],
    [renderStatus, variant],
  );

  return (
    <AllQueryResultTable<'listIdentityGroups'>
      columnDefinitions={columnDefinitions}
      allQueryResult={allQueryResult}
      disableFilters
      disablePagination
      disableSettings
      {...props}
    />
  );
};
