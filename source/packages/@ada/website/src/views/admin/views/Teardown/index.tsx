/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel } from '$northstar-plus';
import { RootAdminGate } from '$views/admin/components/AdminGate';
import { TeardownPage } from '$views/admin/components/TeardownPage';
import { useI18nContext } from '$strings';
import React from 'react';

export const TeardownView: React.FC = () => {
  return (
    <RootAdminGate>
      <HelpInfo />
      <TeardownPage />
    </RootAdminGate>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.ADMIN.HELP.TEARDOWN.header()}>
      {import('@ada/strings/markdown/view/admin/help.teardown.md')}
    </ManagedHelpPanel>
  );
}
