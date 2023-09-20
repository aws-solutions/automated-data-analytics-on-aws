/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { CustomResource, Duration } from 'aws-cdk-lib';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { TypescriptFunction } from '../lambda/typescript-function';

export interface CustomResourceSecretsManagerStoreProps {
  readonly secretName: string;
  readonly kmsKey: Key;
}

export class CustomResourceSecretsManagerStore extends Construct {
  constructor(scope: Construct, id: string, props: CustomResourceSecretsManagerStoreProps) {
    super(scope, id);

    const { secretName, kmsKey } = props;

    const secret = new Secret(this, 'Secret', {
      encryptionKey: kmsKey,
      secretName,
    });

    const rotationHandler = new TypescriptFunction(this, 'Rotation-Lambda', {
      package: 'identity-service',
      handlerFile: require.resolve(`./lambda/rotate-secret`),
      environment: {
        SECRET_NAME: secretName,
        KEY_ID: kmsKey.keyId,
      },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['kms:GenerateDataKey'],
          resources: [kmsKey.keyArn],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'secretsManager:GetSecretValue',
            'secretsManager:PutSecretValue',
            'secretsManager:DescribeSecret',
            'secretsManager:UpdateSecretVersionStage',
          ],
          resources: [secret.secretFullArn!],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['secretsmanager:GetRandomPassword'],
          resources: ['*'],
        }),
      ],
    });

    rotationHandler.addPermission('rotationHandlerPermission', {
      principal: new ServicePrincipal('secretsmanager.amazonaws.com'),
    });

    secret.addRotationSchedule('AutoRotateSecret', {
      automaticallyAfter: Duration.days(90),
      rotationLambda: rotationHandler,
      rotateImmediatelyOnUpdate: false,
    });

    const handler = new TypescriptFunction(this, 'WriteLambda', {
      // force re-deployment
      package: 'identity-service',
      handlerFile: require.resolve(`./lambda/write-secret`),
      environment: {
        SECRET_NAME: secretName,
        KEY_ID: kmsKey.keyId,
      },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['kms:GenerateDataKey'],
          resources: [kmsKey.keyArn],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['secretsManager:GetSecretValue', 'secretsManager:PutSecretValue'],
          resources: [secret.secretFullArn!],
        }),
      ],
    });

    const secretsManagerProvider = new Provider(this, 'Provider', {
      onEventHandler: handler,
    });

    return new CustomResource(this, 'Instance', {
      serviceToken: secretsManagerProvider.serviceToken,
    });
  }
}
