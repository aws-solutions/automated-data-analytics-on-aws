/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '$views/admin/components/AdminGate';
import { Route, Switch } from 'react-router-dom';
import { VisualisationRootView } from '$views/visualisation/views/Root';

export const VisualisationRouter = () => {
  return (
    <AdminGate>
      <Switch>
        <Route component={VisualisationRootView} />
      </Switch>
    </AdminGate>
  );
};
