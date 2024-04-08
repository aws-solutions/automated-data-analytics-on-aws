/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '$views/admin/components/AdminGate';
import { BudgetRootView } from '$views/budget/views/Root';
import { CreateBudgetView } from './Create';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import { UpdateBudgetView } from './Update';

export const BudgetRouter = () => {
  const { path } = useRouteMatch();

  return (
    <AdminGate>
      <Switch>
        <Route path={`${path}/new`} component={CreateBudgetView} />
        <Route path={`${path}/edit`} component={UpdateBudgetView} />
        <Route component={BudgetRootView} />
      </Switch>
    </AdminGate>
  );
};
