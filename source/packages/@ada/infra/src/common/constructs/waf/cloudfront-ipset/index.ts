/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CFN_RESOURCE_TYPE, ResourceProperties } from './types';
import { Construct } from 'constructs';
import { CustomResource } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IPSet } from 'aws-sdk/clients/wafv2';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { TypescriptFunction } from '../../lambda/typescript-function';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';

export interface CloudfrontIPSetProps {
  name: string;
  description: string;
  ipAddressVersion: IPSet['IPAddressVersion'];
  addresses: IPSet['Addresses'];
}

/**
 * Cloudfront scoped IPSet must be defined in `us-east-1`, therefore to enable solution
 * as a single root stack we need a custom resource to manage the IPSet creation
 * cross-region.
 */
export class CloudfrontIPSet extends Construct {
  public readonly ipSetName: string;
  public readonly ipSetId: string;
  public readonly ipSetArn: string;

  private readonly resource: CustomResource;

  constructor(scope: Construct, id: string, props: CloudfrontIPSetProps) {
    super(scope, id);

    const { name, description, addresses, ipAddressVersion } = props;

    const handler = new TypescriptFunction(this, 'Handler', {
      handlerFile: require.resolve('./handler'),
    });
    handler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['wafv2:CreateIPSet', 'wafv2:UpdateIPSet', 'wafv2:DeleteIPSet', 'wafv2:GetIPSet'],
        resources: ['*'],
      }),
    );
    addCfnNagSuppressionsToRolePolicy(handler.role!, [
      {
        id: 'W12',
        reason: '* resource required for creating the WAFv2 IPSet',
      },
    ]);

    const provider = new Provider(this, 'Provider', {
      onEventHandler: handler,
    });

    // ensure resource is replaces when ipAddressVersion changes
    this.resource = new CustomResource(this, 'Resource' + ipAddressVersion, {
      serviceToken: provider.serviceToken,
      properties: {
        Name: name,
        IPAddressVersion: ipAddressVersion,
        Addresses: addresses,
        Description: description,
      } as ResourceProperties,
      resourceType: CFN_RESOURCE_TYPE,
    });

    this.ipSetName = name;
    this.ipSetId = this.resource.getAttString('Id');
    this.ipSetArn = this.resource.getAttString('ARN');
  }

  bind(scope: Construct): void {
    scope.node.addDependency(this.resource);
  }
}
