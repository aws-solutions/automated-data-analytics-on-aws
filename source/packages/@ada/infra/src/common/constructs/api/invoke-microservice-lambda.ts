/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { CfnResource, CustomResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DefaultUser } from '../../services/types/data-product';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { MicroserviceApiRequestProps, buildApiRequest } from '../../../services/api/api-gateway/api-request';
import { addCfnNagSuppressions } from '@ada/cdk-core';

export interface InvokeMicroserviceLambdaProps extends MicroserviceApiRequestProps {
  readonly lambda: IFunction;
}

/**
 * Construct for calling a microservice lambda as the "system" user
 */
export default class InvokeMicroserviceLambda extends AwsCustomResource {
  static makeSequential(invocations: InvokeMicroserviceLambda[]): void {
    for (let i = 1; i < invocations.length; i++) {
      const prev = invocations[i - 1];
      const cur = invocations[i];
      cur.invokeAfter(prev);
    }
  }

  constructor(scope: Construct, id: string, { lambda, pathParameters, body }: InvokeMicroserviceLambdaProps) {
    super(scope, id, {
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          // lambda.functionArn as resource here gave a permission denied error
          resources: ['*'],
        }),
      ]),
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: lambda.functionArn,
          Payload: JSON.stringify(
            buildApiRequest(
              { userId: DefaultUser.SYSTEM, username: DefaultUser.SYSTEM, groups: [DefaultUser.SYSTEM] },
              {
                pathParameters,
                body,
              },
            ),
          ),
        },
        physicalResourceId: PhysicalResourceId.of(id),
      },
    });
    // ensure the latest version of the lambda has been deployed
    this.node.addDependency(lambda.latestVersion);
    addCfnNagSuppressions(this.node.findChild('CustomResourcePolicy').node.defaultChild as CfnResource, [
      {
        id: 'W12',
        reason: '[*] Resource required for custom resource invoking lambda since scoping to functionArn did not work',
      },
    ]);
  }

  /**
   * Add dependency on another InvokeMicroserviceLambda to ensure sequenctial ordering
   * and prevent rate limitting.
   * @param predecessor
   */
  invokeAfter(predecessor: InvokeMicroserviceLambda): void {
    const _instance = (this.node.defaultChild as CustomResource).node.defaultChild as CfnResource;
    const _predecessor = (predecessor.node.defaultChild as CustomResource).node.defaultChild as CfnResource;
    _instance.addDependency(_predecessor);
  }
}
