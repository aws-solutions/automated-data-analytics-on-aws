/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateDataProductView as CreateView } from './Create';
import { DataProductDetailView as DetailView } from './Detail';
import { DataProductRootView as RootView } from './Root';
import { Route, Switch, useRouteMatch } from 'react-router-dom';

export const DataProductRouter = () => {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route path={`${path}/:domainId?/new`} component={CreateView} />
      <Route path={`${path}/:domainId/:dataProductId`} component={DetailView} />
      <Route path={`${path}/:domainId?`} component={RootView} />
      <Route component={RootView} />
    </Switch>
  );
};
