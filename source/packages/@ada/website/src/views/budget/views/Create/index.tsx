/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BudgetWizard } from '../../components/BudgetWizard';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '$strings';
import React from 'react';

export const CreateBudgetView: React.FC = () => {
  return (
    <>
      <HelpInfo />
      <BudgetWizard />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.BUDGET.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/budget/help.md')}
    </ManagedHelpPanel>
  );
};
