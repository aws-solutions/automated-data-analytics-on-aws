/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Construct } from 'constructs';
import { FederatedRestApi } from '../../../../common/constructs/api/federated-api';
import { IDecoratedResource } from '../../../../common/constructs/api/federated-api/base';
import { ResourceOptions } from 'aws-cdk-lib/aws-apigateway';

export interface BaseApiRoutesProps {
  readonly api: FederatedRestApi;
  readonly routePath: string;
  readonly routeResourceOptions?: ResourceOptions;
}

export class BaseApiRoutes extends Construct {
  readonly route: IDecoratedResource;

  constructor(scope: Construct, id: string, props: BaseApiRoutesProps) {
    super(scope, id);

    const { api, routePath, routeResourceOptions } = props;

    this.route = api.addRootResource(routePath, routeResourceOptions);
  }
}
