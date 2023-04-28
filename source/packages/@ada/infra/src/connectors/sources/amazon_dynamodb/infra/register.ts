/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { ConnectorIntegrator } from './static';
import { Connectors } from '@ada/connectors/interface';
import { ID } from '../index';
import DynamicStack from './dynamic/stack';
import type { DataIngressECSCluster } from '@ada/services/data-product/container/infra/ecs-cluster';
import type ImportDataStateMachine from './static/import-data-state-machine';
declare module '@ada/connectors/interface' {
  interface CONNECTOR_INFRA_REGISTRY {
    [ID]: Connectors.IConnectorInfra<
      // Static Parameters
      {
        dynamoDBConnector: Connectors.Infra.Static.ImportData.StateMachine.Param;
      },
      // Static Refs
      {
        dynamoDBConnector: Connectors.Infra.Static.ImportData.StateMachine.Ref;
      },
      // Static Stack Properties
      {
        readonly amazonDynamoDBECSCluster: DataIngressECSCluster;
        readonly amazonDynamoDBImportDataStateMachine: ImportDataStateMachine;
      }
    >;
  }
}

Connectors.Infra.register(ID, {
  staticIntegrator: ConnectorIntegrator,
  dynamicStackClass: DynamicStack,
});
