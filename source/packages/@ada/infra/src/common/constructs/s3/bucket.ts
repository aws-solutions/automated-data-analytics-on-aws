/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BlockPublicAccess, BucketEncryption, BucketProps, Bucket as S3Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ENV_TEST } from '../../env';
import { RemovalPolicy } from 'aws-cdk-lib';
import { kebabCase } from 'lodash';
import KMSStack from '../../../nested-stacks/kms-stack';
import type { Mutable } from '../../../../../../../@types/ts-utils';

interface ExtendedBucketProps
  extends Omit<BucketProps, 'encryption' | 'bucketName' | 'autoDeleteObjects' | 'removalPolicy'> {
  readonly encryption?: BucketProps['encryption'] | null;
  /**
   * Indicates if bucket is retained when solution is deleted.
   *
   * If `true`, sets the buckets `removalPolicy: RemovalPolicy.RETAIN, autoDeleteObjects: true` as well as
   * the encryption KmsKey `removalPolicy` to match if custom key is used.
   * @default false
   */
  readonly retain?: boolean;
}

export class Bucket extends S3Bucket {
  constructor(scope: Construct, id: string, { encryption, encryptionKey, ...props }: ExtendedBucketProps) {
    const { retain, ...bucketProps } = props;

    if (ENV_TEST) {
      // force bucketName to id for testing deterministic value
      (props as Mutable<BucketProps>).bucketName = kebabCase(id);
    }

    if (encryption === null || encryption === BucketEncryption.S3_MANAGED) {
      encryption = BucketEncryption.S3_MANAGED;
    } else if (encryption === undefined && encryptionKey == null) {
      encryption = BucketEncryption.KMS;
      encryptionKey = KMSStack.createKey(scope, `BucketKey-${id}`, {
        description: `Key for bucket ${id}`,
        // Need to ensure KMS Key is also retained if the bucket is, otherwise the data
        // in the bucket will not be decryptable.
        removalPolicy: retain ? RemovalPolicy.RETAIN : undefined,
      });
    }

    super(scope, id, {
      enforceSSL: true,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !retain,
      encryption,
      encryptionKey,
      ...bucketProps,
    });
  }
}
