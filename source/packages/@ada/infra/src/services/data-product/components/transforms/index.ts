/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { getAssetsPath } from '@ada/infra-common';
import { getTransformWrapperScriptS3Folder } from '@ada/microservice-common';

export interface TransformsProps {
  readonly scriptBucket: Bucket;
}

export default class Transforms extends Construct {
  constructor(scope: Construct, id: string, props: TransformsProps) {
    super(scope, id);

    // Upload the transform wrapper to our script bucket
    new BucketDeployment(this, 'DeployTransformWrapper', {
      destinationBucket: props.scriptBucket,
      sources: [Source.asset(getAssetsPath('scripts/transform_wrapper'))],
      destinationKeyPrefix: getTransformWrapperScriptS3Folder(),
    });
  }
}
