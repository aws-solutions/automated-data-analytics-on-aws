/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* istanbul ignore file */

import { Construct } from 'constructs';
import { CounterTable } from '../constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../services/api/components/entity/constructs/entity-management-tables';
import { ExtendedNestedStack } from '@ada/cdk-core';
import { FederatedRestApi } from '../constructs/api/federated-api';
import { InternalTokenKey } from '../constructs/kms/internal-token-key';
import { MicroserviceConfig } from './types';
import { NestedStackProps } from 'aws-cdk-lib';
import { NotificationBus } from '../../services/api/components/notification/constructs/bus';
import { VError } from 'verror';

export * from './api';

export * from './types';

export * from './ddb';

export * from './utils';

interface BaseMicroserviceInternalProps extends MicroserviceConfig, NestedStackProps {}

export type BaseMicroserviceProps = Omit<BaseMicroserviceInternalProps, 'serviceName' | 'serviceNamespace'>;

export class BaseMicroservice extends ExtendedNestedStack {
  private static readonly SERVICES: { [name: string]: BaseMicroservice } = {};

  readonly name: string;
  readonly namespace: string;

  constructor(scope: Construct, id: string, props: BaseMicroserviceInternalProps) {
    super(scope, id, props);

    const { serviceName, serviceNamespace } = props;

    // Verify that service name and namespace are unique
    Object.values(BaseMicroservice.SERVICES).forEach((service) => {
      if (service.name === serviceName)
        throw new VError(
          { name: 'MicroserviceNameAlreadyExistsError' },
          `Microservice with name "${serviceName}" already exists`,
        );
      if (service.namespace === serviceNamespace)
        throw new VError(
          { name: 'ServiceNamespaceAlreadyExistsError' },
          `Microservice with namespace "${serviceNamespace}" already exists`,
        );
    });

    this.name = serviceName;
    this.namespace = serviceNamespace;
  }
}

interface MicroserviceInternalProps extends BaseMicroserviceInternalProps {
  readonly federatedApi: FederatedRestApi;
  readonly notificationBus: NotificationBus;
  readonly counterTable: CounterTable;
  readonly internalTokenKey: InternalTokenKey;
  readonly entityManagementTables: EntityManagementTables;
}

export type MicroserviceProps = Omit<MicroserviceInternalProps, 'serviceName' | 'serviceNamespace'>;

export class Microservice extends BaseMicroservice {
  constructor(scope: Construct, id: string, props: MicroserviceInternalProps) {
    super(scope, id, props);
  }
}
