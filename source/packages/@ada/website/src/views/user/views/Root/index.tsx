/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { UserTable } from '../../components/tables/UserTable';
import { useI18nContext } from '$strings';
import React from 'react';

export interface UserRootProps {}

export const UserRootView: React.FC<UserRootProps> = () => {
  const { LL } = useI18nContext();

  return (
    <>
      <HelpInfo />
      <PageLayout title={LL.VIEW.USER.title()} subtitle={LL.VIEW.USER.subtitle()}>
        <UserTable />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.USER.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/user/help.md')}
    </ManagedHelpPanel>
  );
}
