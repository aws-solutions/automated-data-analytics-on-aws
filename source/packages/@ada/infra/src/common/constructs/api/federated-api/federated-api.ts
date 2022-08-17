/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseRestApi, BaseRestApiProps, IDecoratedResource } from './base';
import { Construct } from 'constructs';
import { ResourceProps } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

export type FederatedRestApiProps = BaseRestApiProps;

export class FederatedRestApi extends BaseRestApi {
  constructor(scope: Construct, id: string, props: FederatedRestApiProps) {
    super(scope, id, props);
  }

  addMicroservice(
    scope: Construct,
    name: string,
    namespace: string,
    props?: Omit<ResourceProps, 'parent' | 'parentPath'>,
  ): IMicroserviceApi {
    if (Stack.of(this) === Stack.of(scope)) {
      throw new Error(`Microservice "${name}" must be in separate nested stack than RestApi stack`);
    }

    // ensure locally scope reference to parent resource to de-couple dependency
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#breaking-up-methods-and-resources-across-stacks
    const apiRef = this.createApiRef(scope, 'RestApiRef');
    const serviceResource = this.decorateResource(
      apiRef.root.addResource(namespace, {
        // propage api defaults to microservice "root" resource - since lives in different stack this is not automatic
        defaultCorsPreflightOptions: this.root.defaultCorsPreflightOptions,
        defaultIntegration: this.root.defaultIntegration,
        defaultMethodOptions: this.root.defaultMethodOptions,
        ...props,
      }),
    ) as unknown as IMicroserviceApiProps & IDecoratedResource;
    serviceResource.name = name;
    serviceResource.namespace = namespace;

    return serviceResource;
  }
}

interface IMicroserviceApiProps {
  name: string;
  namespace: string;
}

export interface IMicroserviceApi extends Readonly<IMicroserviceApiProps>, IDecoratedResource {}
