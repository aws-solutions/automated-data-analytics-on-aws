/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '../components/AdminGate';
import { BudgetRouter } from '$views/budget/views/router';
import { CostRouter } from '$views/cost/views/router';
import { IdentityProviderRouter } from '$views/identity-provider/views/router';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { TeardownView } from './Teardown';
import { VisualisationRouter } from '$views/visualisation/views/router';

export const AdminRouter = () => {
  const { path } = useRouteMatch();

  return (
    <AdminGate>
      <Switch>
        <Route path={`${path}/cost`} component={CostRouter} />
        <Route path={`${path}/identity/provider`} component={IdentityProviderRouter} />
        <Route path={`${path}/budget`} component={BudgetRouter} />
        <Route path={`${path}/visualization`} component={VisualisationRouter} />

        <Route path={`${path}/teardown`} component={TeardownView} />
        <Redirect to="/" />
      </Switch>
    </AdminGate>
  );
};
