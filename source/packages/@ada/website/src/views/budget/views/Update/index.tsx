/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BudgetWizard } from '../../components/BudgetWizard';
import { ErrorAlert } from '$common/components';
import { Link } from 'aws-northstar';
import { ManagedHelpPanel, PageNotFound } from '$northstar-plus';
import { apiHooks } from '$api';
import { isNotFoundError } from '$common/utils';
import { useI18nContext } from '$strings';
import React, { useMemo } from 'react';

export const UpdateBudgetView: React.FC = () => {
  const { LL } = useI18nContext();
  const [ budget, queryInfo ] = apiHooks.useAdministrationBudgets({});

  const formData = useMemo(() => {
    if(budget) {
      return {
        ...budget,
        budgetLimit: String(budget.budgetLimit),
        softNotifications: budget.softNotifications?.map(n => n.threshold || 0).sort((a, b) => a-b),
        subscriberList: budget.subscriberList?.map(s => ({
          label: s,
          value: s,
        }))
      }
    } 
    return undefined;
  }, [budget]);

  if (isNotFoundError(queryInfo.error)) {
    return (
      <PageNotFound
        description={
          <>
            {LL.VIEW.error.notFoundOf({ type: LL.ENTITY.Budgets() })}
            <pre>{queryInfo.error?.message}</pre>
          </>
        }
        destinationLinks={[
          <Link key="0" href="/admin/budget/">
            {LL.VIEW.misc.seeAll(LL.ENTITY.Budget())}
          </Link>,
        ]}
      />
    );
  }
  
  return (
    <>
      <HelpInfo />
      {queryInfo.error ? <ErrorAlert error={queryInfo.error} /> : <BudgetWizard initialValues={formData}/>}
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
