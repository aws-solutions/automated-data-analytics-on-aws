/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { CloudFrontWebDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { Code, Function as LambdaFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { getCustomResourcePath } from '../../utils';

export const WEBSITE_CONFIGURATION_FILE_NAME = 'runtime-config.js';

export interface UploadWebsiteConfigurationProps {
  readonly configuration: { [key: string]: string | string[] };
  readonly websiteBucket: Bucket;
  readonly cloudFrontDistribution: CloudFrontWebDistribution;
  readonly bucketDeployment: BucketDeployment;
}

export default class UploadWebsiteConfiguration extends Construct {
  constructor(scope: Construct, id: string, props: UploadWebsiteConfigurationProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const { websiteBucket, configuration, cloudFrontDistribution, bucketDeployment } = props;

    const uploadWebsiteConfigFunction = new LambdaFunction(this, 'Lambda', {
      description: 'Generate the website runtime-config.js file and upload to website bucket',
      runtime: Runtime.PYTHON_3_9,
      handler: 'app.on_event',
      code: Code.fromAsset(getCustomResourcePath('upload-website-config')),
      timeout: Duration.seconds(60),
      tracing: Tracing.ACTIVE,
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['cloudfront:GetInvalidation', 'cloudfront:CreateInvalidation'],
          resources: [
            stack.formatArn({
              resource: 'distribution',
              service: 'cloudfront',
              resourceName: cloudFrontDistribution.distributionId,
              region: '', // global service
            }),
          ],
        }),
      ],
    });

    websiteBucket.grantWrite(uploadWebsiteConfigFunction);

    const uploadWebsiteConfigProvider = new Provider(this, `UploadWebsiteConfigProvider`, {
      onEventHandler: uploadWebsiteConfigFunction,
    });

    const websiteConfiguration = `window['runtime-config'] = ${JSON.stringify(configuration, null, 2)};`;

    const uploadWebsiteConfigResource = new CustomResource(this, `UploadWebsiteConfigResource`, {
      serviceToken: uploadWebsiteConfigProvider.serviceToken,
      // Pass the mapping file attributes as a property. Every time the mapping file changes, the custom resource will be updated which will trigger the corresponding Lambda.
      properties: {
        S3_BUCKET: websiteBucket.bucketName,
        S3_CONFIG_FILE_KEY: WEBSITE_CONFIGURATION_FILE_NAME,
        WEBSITE_CONFIG: websiteConfiguration,
        CLOUDFRONT_DISTRIBUTION_ID: cloudFrontDistribution.distributionId,
        // The bucket deployment clears the s3 bucket, so we must always run the custom resource to write the config
        ALWAYS_UPDATE: new Date().toISOString(),
      },
    });

    uploadWebsiteConfigResource.node.addDependency(bucketDeployment);
  }
}
