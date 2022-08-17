/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import { UserDetailView } from './Detail';
import { UserRootView } from './Root';

export const UserRouter = () => {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route exact path={`${path}/`} component={UserRootView} />
      <Route path={`${path}/:userId?`} component={UserDetailView} />
      <Route component={UserDetailView} />
    </Switch>
  );
};
