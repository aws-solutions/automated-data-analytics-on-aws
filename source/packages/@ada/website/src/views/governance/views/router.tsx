/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateOntologyView } from './Create';
import { OntologyDetailView } from './Detail';
import { OntologyRootView } from './Root';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import { UpdateOntologyView } from './Update';

export const GovernanceRouter = () => {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route path={`${path}/new`} component={CreateOntologyView} />
      <Route path={`${path}/:ontologyId/edit`} component={UpdateOntologyView} />
      <Route path={`${path}/:ontologyId`} component={OntologyDetailView} />
      <Route component={OntologyRootView} />
    </Switch>
  );
};
