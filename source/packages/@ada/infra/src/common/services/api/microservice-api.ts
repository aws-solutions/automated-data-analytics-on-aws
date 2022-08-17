/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FederatedRestApi, IMicroserviceApi } from '../../constructs/api/federated-api';
import { MicroserviceConfig } from '../types';

export interface MicroserviceApiProps extends MicroserviceConfig {
  readonly federatedApi: FederatedRestApi;
}

export class MicroserviceApi extends Construct {
  readonly api: IMicroserviceApi;
  readonly basePath: string;

  /**
   * The deployed URL of this microservice within the federated REST API.
   */
  readonly url: string;

  private readonly federatedApi: FederatedRestApi;

  constructor(scope: Construct, id: string, props: MicroserviceApiProps) {
    super(scope, id);

    const { federatedApi, serviceName, serviceNamespace } = props;

    this.federatedApi = federatedApi;
    this.basePath = `/${serviceNamespace}`;

    // create nested-api for microservice in federated api
    this.api = federatedApi.addMicroservice(this, serviceName, serviceNamespace);

    this.url = federatedApi.urlForPath(serviceNamespace);

    new CfnOutput(this, `${serviceName}Url`, {
      value: this.url,
    });
  }

  /**
   * Returns the URL for an HTTP path within the microservice.
   *
   * Fails if `deploymentStage` is not set either by `deploy` or explicitly.
   *
   * @stability stable
   */
  urlForPath(path: string): string {
    return `${this.url}/${normalizePath(path)}`;
  }

  /**
   * Gets the "execute-api" ARN.
   *
   * @param method The method (default `*`).
   * @param path The resource path.
   * @param stage The stage (default `*`).
   * @returns The "execute-api" ARN.
   * @default "*" returns the execute API ARN for all methods/resources in
   * this API.
   * @stability stable
   */
  arnForExecuteApi(method?: string, path?: string, stage?: string): string {
    if (path == null) {
      path = this.basePath;
    } else {
      path = this.basePath + '/' + normalizePath(path);
    }
    return this.federatedApi.arnForExecuteApi(method, path, stage);
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('/')) path = path.substring(1); // remove root slash
  return path;
}
