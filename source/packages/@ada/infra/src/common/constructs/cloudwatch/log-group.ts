/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  LogGroup as CloudWatchLogGroup,
  LogGroupProps as CloudWatchLogGroupProps,
  RetentionDays,
} from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { getUniqueKmsKeyAlias, pascalCase } from '@ada/cdk-core';

export type LogGroupProps = CloudWatchLogGroupProps;

const SINGLETON_LOG_GROUP_KMS_KEY_CONSTRUCT_NAME = 'LogGroupEncryptionKmsKey';

/**
 * Wrapper construct for a log group with sensible defaults, including using our own singleton kms key for encryption
 */
export class LogGroup extends CloudWatchLogGroup {
  constructor(scope: Construct, id: string, props?: LogGroupProps) {
    super(scope, id, {
      ...props,
      encryptionKey: props?.encryptionKey || LogGroup.singletonEncryptionKey(scope),
      removalPolicy: props?.removalPolicy || RemovalPolicy.DESTROY,
      retention: props?.retention || RetentionDays.TWO_YEARS,
    });
  }

  /**
   * Create or return the single encryption key for all log groups within the stack
   */
  public static singletonEncryptionKey = (scope: Construct): Key => {
    const stack = Stack.of(scope);

    const existingKey = stack.node.tryFindChild(SINGLETON_LOG_GROUP_KMS_KEY_CONSTRUCT_NAME);
    if (existingKey) {
      return existingKey as Key;
    }
    const key = new Key(stack, SINGLETON_LOG_GROUP_KMS_KEY_CONSTRUCT_NAME, {
      enableKeyRotation: true,
      alias: getUniqueKmsKeyAlias(scope, `loggroup/stack/${pascalCase(stack.node.id).substring(0, 150)}`),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html
    key.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': stack.formatArn({
              service: 'logs',
              resource: '*',
            }),
          },
        },
      }),
    );

    return key;
  };
}
