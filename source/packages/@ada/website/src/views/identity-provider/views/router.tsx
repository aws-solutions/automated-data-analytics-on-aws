/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '$views/admin/components/AdminGate';
import { CreateIdentityProviderView } from './Create';
import { IdentityProviderDetailView } from './Detail';
import { IdentityProviderRootView } from './Root';
import { Route, Switch, useRouteMatch } from 'react-router-dom';

export const IdentityProviderRouter = () => {
  const { path } = useRouteMatch();

  return (
    <AdminGate>
      <Switch>
        <Route path={`${path}/new`} component={CreateIdentityProviderView} />
        <Route path={`${path}/:identityProviderId`} component={IdentityProviderDetailView} />
        <Route component={IdentityProviderRootView} />
      </Switch>
    </AdminGate>
  );
};
