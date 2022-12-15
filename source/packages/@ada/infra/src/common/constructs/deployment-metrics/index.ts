/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { solutionInfo } from '@ada/common';

export interface DeploymentMetricsCollectionProps {
  sendAnonymousData: string;
}

export class DeploymentMetricsCollection extends Construct {
  public readonly anonymousDataUUID: string;
  public readonly sendAnonymousData: string;

  constructor(scope: Construct, id: string, props: DeploymentMetricsCollectionProps) {
    super(scope, id);

    this.sendAnonymousData = props.sendAnonymousData;

    const lambda = new NodejsFunction(this, 'Lambda', {
      entry: require.resolve('./handler'),
      handler: 'handler',
      description: 'Lambda for Deployment Metrics collection',
    });

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: lambda,
    });

    const { awsSolutionId, awsSolutionVersion } = solutionInfo();
    const customResource = new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        awsSolutionId,
        awsSolutionVersion,
        awsRegion: cdk.Aws.REGION,
        sendAnonymousData: this.sendAnonymousData,
      },
    });

    this.anonymousDataUUID = customResource.getAttString('anonymousDataUUID');
  }
}
