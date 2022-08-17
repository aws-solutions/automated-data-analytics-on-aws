/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdminGate } from '$views/admin/components/AdminGate';
import { CostRootView } from '$views/cost/views/Root';
import { Route, Switch } from 'react-router-dom';

export const CostRouter = () => {
  return (
    <AdminGate>
      <Switch>
        <Route component={CostRootView} />
      </Switch>
    </AdminGate>
  );
};
