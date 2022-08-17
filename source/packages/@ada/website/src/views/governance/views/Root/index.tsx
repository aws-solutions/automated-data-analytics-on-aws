/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { OntologiesTable } from './components/Table';
import { useI18nContext } from '$strings';
import React from 'react';

/**
 * Page to show all ontologies
 */
export const OntologyRootView: React.FC = () => {
  const { LL } = useI18nContext();

  return (
    <>
      <HelpInfo/>
      <PageLayout title={LL.VIEW.GOVERNANCE.title()} subtitle={LL.VIEW.GOVERNANCE.subtitle()}>
        <OntologiesTable />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GOVERNANCE.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/governance/help.md')}
    </ManagedHelpPanel>
  );
}
