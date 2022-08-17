/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateGroupView as CreateView } from './Create';
import { GroupDetailView as DetailView } from './Detail';
import { GroupRootView as RootView } from './Root';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import { UpdateGroupView as UpdateView } from './Update';

export const GroupRouter = () => {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route exact path={`${path}/new`} component={CreateView} />
      <Route exact path={`${path}/:groupId/edit`} component={UpdateView} />
      <Route path={`${path}/:groupId`} component={DetailView} />
      <Route component={RootView} />
    </Switch>
  );
};
