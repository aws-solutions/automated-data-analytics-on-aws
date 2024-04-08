/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BudgetDetails } from '../../components/Details';
import { BudgetLandingPage } from '../../components/LandingPage';
import { Button, Inline } from 'aws-northstar';
import { DeleteBudgetButton } from '../../components/DeleteBudgetButton';
import { ErrorAlert } from '$common/components';
import { ManagedHelpPanel, PageLayout, Skeletons } from '$northstar-plus';
import { apiHooks } from '$api';
import { isNotFoundError } from '$common/utils';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useMemo } from 'react';

export interface BudgetRootViewProps { }

export const BudgetRootView: React.FC<BudgetRootViewProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const [budget, queryInfo] = apiHooks.useAdministrationBudgets({});

  const actions = useMemo(() => {
    return budget ? (<Inline spacing="s">
      <DeleteBudgetButton />
      <Button variant="primary" onClick={() => history.push('/admin/budget/edit')}>
        {LL.ENTITY.Budget__UPDATE()}
      </Button>
    </Inline>) : (<Button variant="primary" onClick={() => history.push('/admin/budget/new')}>
      {LL.ENTITY.Budget__CREATE()}
    </Button>);
  }, [budget]);

  if (queryInfo.isLoading) {
    return (<>
      <HelpInfo />
      <Skeletons.Page title={LL.VIEW.BUDGET.title()} />
    </>);
  }

  return (
    <>
      <HelpInfo />
      <PageLayout title={LL.VIEW.BUDGET.title()} actionButtons={actions}>
        {queryInfo.error && !isNotFoundError(queryInfo.error) ?
          (<ErrorAlert error={queryInfo.error} />) :
          budget ?
            <BudgetDetails budget={budget} />
            : <BudgetLandingPage />}
      </PageLayout>
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
