/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestAction } from '@ada/common';
import { AccessRequestEntity } from '@ada/api';
import { BaseTableProps, CREATED_COLUMN, FlexTable } from '$common/components/tables';
import { Button, Inline, Link } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { useAccessRequestContext } from '$common/entity/access-request';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useUserId } from '$core/provider/UserProvider';
import React, { useMemo } from 'react';
import startCase from 'lodash/startCase';

export interface AccessRequestTableProps
  extends Omit<BaseTableProps<AccessRequestEntity>, 'items' | 'columnDefinitions'> {
  /** Filter to only show requests for specific group */
  groupId?: string;
}

export const AccessRequestTable: React.FC<AccessRequestTableProps> = ({ groupId, ...props }) => {
  const { LL } = useI18nContext();
  const currentUserId = useUserId();

  const { accessRequests, approveRequest, denyRequest, getAccessRequestAcknowledgement } = useAccessRequestContext();

  const columnDefinitions: Column<AccessRequestEntity>[] = useMemo(
    () => [
      {
        id: 'userId',
        accessor: 'userId',
        Header: LL.ENTITY['AccessRequest@'].userId.label(),
        width: 0.3,
      },
      // Do not show group column if already filtered to group
      ...(groupId
        ? []
        : [
            {
              id: 'groupId',
              accessor: 'groupId',
              Header: LL.ENTITY['AccessRequest@'].groupId.label(),
              width: 0.3,
              Cell: ({ value }: any) => <Link href={`/groups/${value}`}>{startCase(value)}</Link>,
            },
          ]),
      {
        ...CREATED_COLUMN,
        Header: LL.VIEW.GROUP.AccessRequest.COLUMN.createdBy.header(),
        width: 0.3,
      } as any,
      {
        id: 'actions',
        Header: LL.VIEW.GROUP.AccessRequest.COLUMN.actions.header(),
        width: 1,
        align: 'right',
        Cell: ({ row }: any) => {
          const { userId: requestor, groupId: group } = row.original;
          const requestee = currentUserId;
          const [processingAction] = getAccessRequestAcknowledgement(row.original) || [];
          const isProcessing = processingAction != null;
          return (
            <Inline>
              {processingAction !== AccessRequestAction.APPROVE && (
                <Button
                  size="small"
                  disabled={isProcessing}
                  loading={processingAction === AccessRequestAction.DENY}
                  onClick={() => denyRequest(
                    row.original,
                    LL.ENTITY.AccessRequest_.ACTIONS.DENY.message({ requestee, requestor, group })
                  )}
                >
                  {LL.ENTITY.AccessRequest_.ACTIONS.DENY.label()}
                </Button>
              )}
              {processingAction !== AccessRequestAction.DENY && (
                <Button
                  size="small"
                  disabled={isProcessing}
                  loading={processingAction === AccessRequestAction.APPROVE}
                  variant="primary"
                  onClick={() => approveRequest(
                    row.original,
                    LL.ENTITY.AccessRequest_.ACTIONS.APPROVE.message({ requestee, requestor, group })
                  )}
                >
                  {LL.ENTITY.AccessRequest_.ACTIONS.APPROVE.label()}
                </Button>
              )}
            </Inline>
          );
        },
      },
    ],
    [groupId, denyRequest, approveRequest, getAccessRequestAcknowledgement],
  );

  const filtedAccessRequests = useMemo(() => {
    if (accessRequests == null) return undefined;
    if (groupId) return accessRequests.filter((v) => v.groupId === groupId);
    return accessRequests;
  }, [groupId, accessRequests]);

  return (
    <FlexTable
      columnDefinitions={columnDefinitions as any}
      items={filtedAccessRequests}
      hideEmptyTable // prevent rendering entire request table when empty
      disableFilters
      disablePagination
      disableSettings
      wrapText={false}
      {...props}
    />
  );
};
