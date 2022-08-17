/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { PublicRootView } from './Root';
import { Route, Switch } from 'react-router-dom';

export const PublicRouter = () => {
  return (
    <Switch>
      <Route component={PublicRootView} />
    </Switch>
  );
};
