/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ArnFormat, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { ArnPrincipal, Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CustomResourceSecretsManagerStore } from '../secret-manager/secret-manager-store';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { SolutionContext, tryGetSolutionContext } from '../../context';
import { addKMSDefaultPolicyCfnNagSuppressions, getUniqueKmsKeyAlias, getUniqueName } from '@ada/cdk-core';

export const INTERNAL_TOKEN_KMS_KEY = 'INTERNAL_TOKEN_KMS_KEY';

export const INTERNAL_TOKEN_SECRET_NAME = 'INTERNAL_TOKEN_SECRET_NAME';

export interface InternalTokenKeyProps {
  readonly keyAlias: string;
  readonly secretName: string;
}

export class InternalTokenKey extends Construct {
  public readonly key: Key;
  public readonly secretName: string;

  constructor(scope: Construct, id: string, props: InternalTokenKeyProps) {
    super(scope, id);

    this.secretName = getUniqueName(scope, props.secretName);
    this.key = new Key(scope, `Key-${id}`, {
      alias: getUniqueKmsKeyAlias(scope, props.keyAlias),
      enableKeyRotation: true,
      removalPolicy: tryGetSolutionContext(scope, SolutionContext.KMS_DEFAULT_REMOVAL_POLICY) || RemovalPolicy.DESTROY,
    });
    addKMSDefaultPolicyCfnNagSuppressions(this.key);

    new CustomResourceSecretsManagerStore(this, 'Secrect', { //NOSONAR (typescript:S1848) - cdk construct is used
      secretName: this.secretName,
      kmsKey: this.key,
    });
  }

  public configureLambdaForDecrypt(lambda: LambdaFunction): void {
    this.key.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: ['*'],
        principals: [
          new ArnPrincipal(`arn:aws:iam::${Stack.of(this).account}:root`),
          new ServicePrincipal('lambda.amazonaws.com'),
        ],
        conditions: {
          StringEquals: {
            'kms:CallerAccount': Stack.of(this).account,
          },
        },
      }),
    );
    lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [this.key.keyArn],
      }),
    );
    lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsManager:GetSecretValue'],
        resources: [
          Stack.of(this).formatArn({
            resource: 'secret',
            service: 'secretsmanager',
            resourceName: `${this.secretName}*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
    lambda.addEnvironment(INTERNAL_TOKEN_KMS_KEY, this.key.keyId);
    lambda.addEnvironment(INTERNAL_TOKEN_SECRET_NAME, this.secretName);
  }
}
