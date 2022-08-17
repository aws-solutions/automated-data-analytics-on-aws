/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestTable } from '../../components/AccessRequestTable';
import { Button, Container, Inline, Link, StatusIndicator } from 'aws-northstar';
import { DefaultGroupIds } from '@ada/common';
import { DeleteGroupButton } from '../../components/DeleteGroup';
import { GroupMemberTable } from '../../components/MemberTable';
import { LLSafeHtmlString, useI18nContext } from '$strings';
import { ManagedHelpPanel, PageLayout, PageNotFound, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { isEmpty, startCase } from 'lodash';
import { isNotFoundError } from '$common/utils';
import { sortApiAccessPolicyIds } from '$common/entity/api-access-policy';
import { useHistory, useParams } from 'react-router-dom';
import { useIsMember, useUserCanModifyEntity, useUserId } from '$core/provider/UserProvider';
import React, { useCallback, useMemo } from 'react';

export interface GroupDetailViewProps {}

export const GroupDetailView: React.FC<GroupDetailViewProps> = () => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();
  const history = useHistory();
  const { groupId } = useParams<{ groupId: string }>();
  const [group, { isLoading, error }] = apiHooks.useIdentityGroup({ groupId });
  const userId = useUserId();
  const isMember = useIsMember(groupId);
  const canEdit = useUserCanModifyEntity(group, { operation: 'putIdentityGroup', allowSystem: true });
  const isDefaultGroup = groupId === DefaultGroupIds.DEFAULT;

  const [apiAccessPolicies] = apiHooks.useApiAccessPolicies();
  const getApiAccessPolicyName = useCallback(
    (id: string): string => {
      if (apiAccessPolicies == null) return startCase(id);
      return apiAccessPolicies.find((policy) => policy.apiAccessPolicyId === id)?.name || startCase(id);
    },
    [apiAccessPolicies],
  );

  const [putIdentityRequest, { isLoading: isPuttingRequest, isSuccess: hasPutRequest }] =
    apiHooks.usePutIdentityRequest({
      onError: (_error, _varriables) => {
        addError({
          header: LL.VIEW.GROUP.AccessRequest.notify.send.failed({ group: _varriables.groupId }),
          content: _error.message,
        });
      },
      onSuccess: ({ groupId: _groupId }) => {
        addSuccess({
          header: LL.VIEW.GROUP.AccessRequest.notify.send.header(),
          content: LL.VIEW.GROUP.AccessRequest.notify.send.content({ group: _groupId }),
        });
      },
    });

  const sendAccessRequest = useCallback(() => {
    putIdentityRequest({
      groupId,
      userId,
      accessRequestInput: {
        message: LL.ENTITY.AccessRequest_.ACTIONS.requestorMessage({ requestor: userId, group: groupId }),
      },
    });
  }, [userId, groupId, putIdentityRequest]);

  const actionButtons = useMemo(() => {
    if (group == null) return null;

    return (
      <Inline>
        {canEdit && <DeleteGroupButton group={group} />}
        {canEdit && <Button onClick={() => history.push(`/groups/${group.groupId}/edit`)}>Edit</Button>}
        {isMember ? (
          <StatusIndicator statusType="positive">{LL.ENTITY.Member()}</StatusIndicator>
        ) : (
          <Button
            variant="primary"
            onClick={sendAccessRequest}
            disabled={hasPutRequest || isPuttingRequest}
            loading={isPuttingRequest}
            label={LL.VIEW.GROUP.AccessRequest.ACTIONS.join.label({ group: group.groupId })}
          >
            {LL.VIEW.GROUP.AccessRequest.ACTIONS.join.text()}
          </Button>
        )}
      </Inline>
    );
  }, [group, isMember, canEdit, hasPutRequest, isPuttingRequest]);

  if (isNotFoundError(error)) {
    return (
      <PageNotFound
        description={<LLSafeHtmlString string="VIEW.GROUP.NOT_FOUND_HTML.description" />}
        destinationLinks={[
          <Link key="0" href="/groups">
            <LLSafeHtmlString string="VIEW.GROUP.NOT_FOUND_HTML.seeAllLink" />
          </Link>,
        ]}
      />
    );
  }

  return (
    <>
      <HelpInfo />
      <PageLayout
        title={startCase(groupId)}
        subtitle={group && group.description}
        isLoading={isLoading}
        actionButtons={actionButtons}
      >
        <AccessRequestTable
          tableTitle={LL.VIEW.GROUP.TABLES.ACCESS_REQUEST.title()}
          tableDescription={LL.VIEW.GROUP.TABLES.ACCESS_REQUEST.description()}
          groupId={groupId}
        />
        {isDefaultGroup && (
          <Container
            title={LL.ENTITY['Group@'].autoAssignUsers.label()}
            subtitle={LL.ENTITY['Group@'].autoAssignUsers.description()}
            headerContent={LL.ENTITY['Group@'].autoAssignUsers.hintText()}
            gutters
          >
            {group?.autoAssignUsers ? (
              <StatusIndicator statusType="positive">
                <LLSafeHtmlString string="VIEW.GROUP.AUTO_ASSIGN_USERS.STATUS_HTML.enabled" />
              </StatusIndicator>
            ) : (
              <StatusIndicator statusType="negative">
                <LLSafeHtmlString string="VIEW.GROUP.AUTO_ASSIGN_USERS.STATUS_HTML.disabled" />
              </StatusIndicator>
            )}
          </Container>
        )}

        {group?.autoAssignUsers ? (
          <Container title={LL.ENTITY.Members()} gutters>
            <StatusIndicator statusType="warning">{LL.VIEW.GROUP.AUTO_ASSIGN_USERS.WARNING.members()}</StatusIndicator>
          </Container>
        ) : (
          <GroupMemberTable tableTitle={LL.ENTITY.Members()} groupId={groupId} />
        )}

        {group?.apiAccessPolicyIds && !isEmpty(group?.apiAccessPolicyIds) && (
          <Container title={LL.ENTITY.ApiAccessPolicy_.AccessLevel.title()} gutters>
            <>
              {sortApiAccessPolicyIds(group.apiAccessPolicyIds || []).map((id: string, i) => (
                <li key={i}>{getApiAccessPolicyName(id)}</li>
              ))}
            </>
          </Container>
        )}
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GROUP.HELP.DETAIL.header()}>
      {import('@ada/strings/markdown/view/group/help.detail.md')}
    </ManagedHelpPanel>
  );
}
