/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateOntologyWizard } from '../../components/Wizard';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '$strings';
import React from 'react';

export interface CreateOntologyViewProps {}

export const CreateOntologyView: React.FC<CreateOntologyViewProps> = () => {
  return (
    <>
      <HelpInfo />
      <CreateOntologyWizard />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GOVERNANCE.HELP.CREATE.header()}>
      {import('@ada/strings/markdown/view/governance/help.create.md')}
    </ManagedHelpPanel>
  );
}
