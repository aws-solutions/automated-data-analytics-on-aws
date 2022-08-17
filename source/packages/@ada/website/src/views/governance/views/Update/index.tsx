/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel } from '$northstar-plus';
import { UpdateOntologyWizard } from '$views/governance/components/Wizard';
import { getOntologyIdFromString } from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useParams } from 'react-router-dom';
import React from 'react';

export const UpdateOntologyView: React.FC = () => {
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const id = getOntologyIdFromString(ontologyId);

  return (
    <>
      <HelpInfo />
      <UpdateOntologyWizard id={id} />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GOVERNANCE.HELP.UPDATE.header()}>
      {import('@ada/strings/markdown/view/governance/help.update.md')}
    </ManagedHelpPanel>
  );
}
