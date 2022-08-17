/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GroupWizard } from '../../components/GroupWizard';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '$strings';
import React from 'react';

export const CreateGroupView: React.FC = () => {
  return (
    <>
      <HelpInfo />
      <GroupWizard />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GROUP.HELP.CREATE.header()}>
      {import('@ada/strings/markdown/view/group/help.create.md')}
    </ManagedHelpPanel>
  );
}
