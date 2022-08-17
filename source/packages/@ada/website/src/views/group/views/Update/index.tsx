/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GroupWizard } from '$views/group/components/GroupWizard';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '$strings';
import { useParams } from 'react-router-dom';
import React from 'react';

export const UpdateGroupView: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <>
      <HelpInfo />
      <GroupWizard groupId={groupId} />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GROUP.HELP.UPDATE.header()}>
      {import('@ada/strings/markdown/view/group/help.update.md')}
    </ManagedHelpPanel>
  );
}
