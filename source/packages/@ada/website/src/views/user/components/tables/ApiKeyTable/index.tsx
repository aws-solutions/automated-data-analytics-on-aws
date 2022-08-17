/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AllQueryResultTable, BaseTableProps, CREATED_COLUMN } from '$common/components/tables';
import { Button, Inline, StatusIndicator } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { CreateApiKeyDialog } from '../../dialog/CreateApiKeyDialog';
import { DeleteTokenButton } from './DeleteTokenButton';
import { RelativeDate, useNotificationContext } from '$northstar-plus';
import { RuntimeConfig } from '../../../../../runtime-config';
import { SummaryRenderer } from '$northstar-plus/components/SummaryRenderer';
import { TokenEntity } from '@ada/api';
import { apiHooks } from '$api';
import { identifierToName } from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useIsAdmin, useUserId } from '$core/provider/UserProvider';
import React, { useCallback, useMemo, useState } from 'react';

export interface ApiKeyTableProps extends Omit<BaseTableProps<TokenEntity>, 'columnDefinitions' | 'items'> {
  readonly userId: string;
}

export const ApiKeyTable: React.FC<ApiKeyTableProps> = ({ userId, selector: _selector, ...props }) => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();
  const currentUserId = useUserId();
  const isAdmin = useIsAdmin();
  const isCurrentUser = userId === currentUserId;
  const isCurrentUserOrAdmin = isCurrentUser || isAdmin;
  const allQueryResult = apiHooks.useAllIdentityMachineTokens({ machineId: userId }, { enabled: isCurrentUserOrAdmin });
  const [, queryInfo] = allQueryResult;
  const refetch = queryInfo.refetch;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // state for token that is having action performed against it (enable, disable)
  const [processingToken, setProcessingToken] = useState<string>();

  const [putMachineToken, { isAllowed: allowCreate }] = apiHooks.usePutIdentityMachineTokenAsync();
  const enableToken = useCallback(
    async ({ machineId, tokenId, expiration, updatedTimestamp }: TokenEntity) => {
      try {
        setProcessingToken(tokenId);
        await putMachineToken({ machineId, tokenId, tokenInput: { expiration, enabled: true, updatedTimestamp } });
        addSuccess({
          header: LL.VIEW.USER.ApiKey.ACTIONS.enable.notify.success(tokenId),
        });
        refetch({ force: true });
      } catch (error: any) {
        addError({
          header: LL.VIEW.USER.ApiKey.ACTIONS.enable.notify.failure(tokenId),
          content: error.message,
        });
      } finally {
        setProcessingToken(undefined);
      }
    },
    [putMachineToken],
  );
  const disableToken = useCallback(
    async ({ machineId, tokenId, expiration, updatedTimestamp }: TokenEntity) => {
      try {
        setProcessingToken(tokenId);
        await putMachineToken({ machineId, tokenId, tokenInput: { expiration, enabled: false, updatedTimestamp } });
        addSuccess({
          header: LL.VIEW.USER.ApiKey.ACTIONS.disable.notify.success(tokenId),
        });
        refetch({ force: true });
      } catch (error: any) {
        addError({
          header: LL.VIEW.USER.ApiKey.ACTIONS.disable.notify.failure(tokenId),
          content: error.message,
        });
      } finally {
        setProcessingToken(undefined);
      }
    },
    [putMachineToken, setProcessingToken, addError, addSuccess],
  );

  const closeCreateDialog = useCallback(() => {
    refetch({ force: true });
    setShowCreateDialog(false);
  }, [refetch, setShowCreateDialog]);

  const columnDefinitions: Column<TokenEntity>[] = useMemo(
    () => [
      {
        id: 'tokenId',
        accessor: 'tokenId',
        width: 1,
        Header: LL.ENTITY.Token(),
        Cell: ({ value }: any) => identifierToName(value),
      },
      {
        id: 'enabled',
        accessor: 'enabled',
        width: 0.2,
        Header: 'Status',
        Cell: ({ value }: any) => (
          <StatusIndicator statusType={value ? 'positive' : 'negative'}>
            {value
              ? LL.VIEW.USER.ApiKey.STATUS.enabled()
              : LL.VIEW.USER.ApiKey.STATUS.disabled()}
          </StatusIndicator>
        ),
      },
      {
        id: 'expiration',
        accessor: 'expiration',
        width: 0.4,
        Header: LL.ENTITY['Token@'].expiration.label(),
        Cell: ({ value }: any) => <RelativeDate date={value} />,
      },
      CREATED_COLUMN as any,
      {
        id: 'actions',
        width: 0.4,
        Header: 'Actions',
        align: 'right',
        Cell: ({ row }: any) => (
          <Inline spacing="s">
            {row.original.enabled ? (
              <Button
                size="small"
                disabled={!!processingToken}
                loading={processingToken === row.original.tokenId}
                onClick={() => disableToken(row.original)}
                label={LL.VIEW.USER.ApiKey.ACTIONS.disable.label(row.original.tokenId)}
              >
                {LL.VIEW.USER.ApiKey.ACTIONS.disable.text()}
              </Button>
            ) : (
              <Button
                size="small"
                disabled={!!processingToken}
                loading={processingToken === row.original.tokenId}
                onClick={() => enableToken(row.original)}
                label={LL.VIEW.USER.ApiKey.ACTIONS.enable.label(row.original.tokenId)}
              >
                {LL.VIEW.USER.ApiKey.ACTIONS.enable.text()}
              </Button>
            )}
            <DeleteTokenButton
              buttonSize="small"
              token={row.original}
              navigateTo="/profile/"
              onDeleted={() => {
                refetch({ force: true });
              }}
            />
          </Inline>
        ),
      },
    ],
    [enableToken, disableToken, processingToken],
  );

  const actionGroup = useMemo(() => {
    if (isCurrentUser) {
      return (
        <Inline>
          <Button
            variant="primary"
            disabled={!allowCreate}
            onClick={allowCreate ? () => setShowCreateDialog(true) : undefined}
          >
            {LL.ENTITY.Token__CREATE()}
          </Button>
        </Inline>
      );
    }
    return null;
  }, [allowCreate, isCurrentUser, setShowCreateDialog]);

  const tableErrorTextHandler = useCallback((error: any): string | undefined => {
    if (error.message && error.message.startsWith('No machine found')) {
      return undefined;
    }
    return error.message;
  }, []);

  // only allow admins and current user to view
  if (!isCurrentUserOrAdmin) {
    return null;
  }

  return (
    <>
      <SummaryRenderer
        sections={[
          {
            title: LL.VIEW.USER.ApiKey.SUMMARY.SECTION.integrationEntpoints.title(),

            properties: [
              {
                label: LL.VIEW.USER.ApiKey.SUMMARY.SECTION.integrationEntpoints.apiUrl(),
                value: RuntimeConfig.apiUrl,
              },
              {
                label: LL.VIEW.USER.ApiKey.SUMMARY.SECTION.integrationEntpoints.athenaProxyApiUrl(),
                value: RuntimeConfig.athenaProxyApiUrl,
              },
            ],
          },
        ]}
      />
      <AllQueryResultTable<'listIdentityMachineTokens'>
        tableTitle={LL.ENTITY.Tokens()}
        tableDescription={LL.ENTITY.Tokens_description()}
        columnDefinitions={columnDefinitions}
        actionGroup={actionGroup}
        allQueryResult={allQueryResult}
        disablePagination
        disableColumnFilters
        disableSettings
        disableFilters
        errorText={tableErrorTextHandler}
        {...props}
      />
      {showCreateDialog && <CreateApiKeyDialog onClose={closeCreateDialog} />}
    </>
  );
};
