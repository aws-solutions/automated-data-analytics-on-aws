/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsS3Instance, S3 } from '@ada/aws-sdk';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';

export interface GetCrawlerStatusRequest {
  readonly bucketName: string;
  readonly key: string;
  readonly attempts: number;
}

export interface GetS3StatusResult extends GetCrawlerStatusRequest {
  readonly hasContents?: boolean;
}

const s3 = AwsS3Instance();

/**
 * Handler for getting the state of the crawler
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GetCrawlerStatusRequest>,
  _context: any,
): Promise<GetS3StatusResult> => {
  const { bucketName, key, attempts } = event.Payload;

  const input = {
    Bucket: bucketName,
    Prefix: key,
    MaxKeys: 1,
  } as S3.Types.ListObjectsV2Request;

  const response = await s3.listObjectsV2(input).promise();

  const hasContents = (response?.Contents || []).length > 0;

  return { ...event.Payload, hasContents: hasContents, attempts: (attempts || 0) + 1 };
};
