/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '../components/AdminGate';
import { CostRouter } from '$views/cost/views/router';
import { IdentityProviderRouter } from '$views/identity-provider/views/router';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { TeardownView } from './Teardown';

export const AdminRouter = () => {
  const { path } = useRouteMatch();

  return (
    <AdminGate>
      <Switch>
        <Route path={`${path}/cost`} component={CostRouter} />
        <Route path={`${path}/identity/provider`} component={IdentityProviderRouter} />

        <Route path={`${path}/teardown`} component={TeardownView} />
        <Redirect to="/" />
      </Switch>
    </AdminGate>
  );
};
