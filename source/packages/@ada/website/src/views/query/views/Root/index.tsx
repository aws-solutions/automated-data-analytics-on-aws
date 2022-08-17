/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { QueryWorkbench } from '../../components/QueryWorkbench';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React from 'react';

export interface QueryRootViewProps {}

export const QueryRootView: React.FC<QueryRootViewProps> = () => {
  return (
    <>
      <HelpInfo />
      <PageLayout layout="chromeless">
        <QueryWorkbench />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.QUERY.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/query/help.md')}
    </ManagedHelpPanel>
  );
}
