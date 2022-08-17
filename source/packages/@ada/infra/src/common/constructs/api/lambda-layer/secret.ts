/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { CfnSecret, Secret, SecretProps } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ENV_TEST } from '../../../env';
import type { GetSecretValueRequest, GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager';

export const TEST_DEPLOYMENT_SECRET_VALUE = 'test-secret-value';

/**
 * Secret that exposes the resolved value directly rather than via dynamic resolution.
 * This is necessary in WAF rules which we use custom function to manage.
 *
 * These secrets are not considered highly sensitive as they just identity unique deployment and used
 * for indicating internal calls for things like WAF.
 */
export class DeploymentSecret extends Secret {
  /** The actual deployed secret value rather than dynamic resolution. */
  readonly value: string;

  constructor(scope: Construct, id: string, props: SecretProps) {
    super(scope, id, props);

    const custom = new AwsCustomResource(this, 'SecretValue', {
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [this.secretArn] }),
      onUpdate: {
        service: 'SecretsManager',
        action: 'getSecretValue',
        parameters: {
          SecretId: this.secretArn,
        } as GetSecretValueRequest,
        physicalResourceId: PhysicalResourceId.of(`DeploymentSecret${id}`),
      },
    });
    custom.node.addDependency(this.node.defaultChild as CfnSecret);

    if (ENV_TEST) {
      this.value = TEST_DEPLOYMENT_SECRET_VALUE;
    } else {
      this.value = custom.getResponseField('SecretString' as keyof GetSecretValueResponse);
    }
  }
}
