/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestTable } from '$views/group/components/AccessRequestTable';
import { Button, Inline } from 'aws-northstar';
import { DefaultGroupIds } from '@ada/common';
import { GroupEntity } from '@ada/api-client';
import { GroupTable } from '../../components/Table';
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { sortBy } from 'lodash';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useOperationAllowed } from '$api/hooks/permissions';
import React, { useCallback, useMemo } from 'react';

export interface GroupRootViewProps {
  readonly pageSize?: number;
}

export const GroupRootView: React.FC<GroupRootViewProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();

  const allowCreate = useOperationAllowed('putIdentityGroup');

  const defaultGroupsSelector = useCallback((groups: GroupEntity[]) => {
    return sortBy(
      groups.filter((group: any) => group.createdBy === 'system'),
      ({ groupId }) => {
        switch (groupId) {
          case DefaultGroupIds.DEFAULT:
            return 0;
          case DefaultGroupIds.POWER_USER:
            return 1;
          case DefaultGroupIds.ADMIN:
            return 99;
          default:
            return groupId;
        }
      },
    );
  }, []);

  const createdGroupsSelector = useCallback((groups: GroupEntity[]) => {
    return sortBy(
      groups.filter((group: any) => group.createdBy !== 'system'),
      ['groupId'],
    );
  }, []);

  const actionGroup = useMemo(() => {
    return (
      <Inline>
        <Button
          variant="primary"
          disabled={!allowCreate}
          onClick={allowCreate ? () => history.push('/groups/new') : undefined}
        >
          {LL.ENTITY.Group__CREATE()}
        </Button>
      </Inline>
    );
  }, [allowCreate]);

  return (
    <>
      <HelpInfo />
      <PageLayout title={LL.VIEW.GROUP.ROOT.title()} subtitle={LL.VIEW.GROUP.ROOT.subtitle()}>
        <HelpInfo />
        <AccessRequestTable
          tableTitle={LL.VIEW.GROUP.TABLES.ACCESS_REQUEST.title()}
          tableDescription={LL.VIEW.GROUP.TABLES.ACCESS_REQUEST.description()}
        />
        <GroupTable
          tableTitle={LL.VIEW.GROUP.TABLES.GROUP.DEFAULT.title()}
          tableDescription={LL.VIEW.GROUP.TABLES.GROUP.DEFAULT.description()}
          variant="system"
          selector={defaultGroupsSelector}
        />
        <GroupTable
          tableTitle={LL.VIEW.GROUP.TABLES.GROUP.CUSTOM.title()}
          tableDescription={LL.VIEW.GROUP.TABLES.GROUP.CUSTOM.description()}
          actionGroup={actionGroup}
          selector={createdGroupsSelector}
        />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GROUP.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/group/help.md')}
    </ManagedHelpPanel>
  );
}
