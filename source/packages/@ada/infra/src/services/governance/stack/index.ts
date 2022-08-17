/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { Microservice, MicroserviceProps } from '../../../common/services';
import GovernanceApi from '../api';
import serviceConfig from '../service-config';

export type GovernanceServiceStackProps = MicroserviceProps;

/**
 * Governance Service Stack
 */
export class GovernanceServiceStack extends Microservice {
  readonly api: GovernanceApi;

  constructor(scope: Construct, id: string, props: GovernanceServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    this.api = new GovernanceApi(this, 'Api', {
      ...serviceConfig,
      ...props,
    });
  }
}

export default GovernanceServiceStack;
