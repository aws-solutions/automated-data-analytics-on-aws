/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsS3Instance } from '@ada/aws-sdk';
import { QueryDownload } from '@ada/api';
import { parseS3Path } from '@ada/microservice-common';
import { validateExecutionDetails } from '../../components/lambda';

const s3 = AwsS3Instance({ signatureVersion: 'v4' });

/**
 * Handler for retrieving the signed url to be used to download the query results
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getQueryResultDownload', async ({ requestParameters }, callingUser) => {
  const result = await validateExecutionDetails(requestParameters.executionId, callingUser);

  if ('statusCode' in result) {
    return result;
  }

  const { output } = result;
  const s3OutputPath = parseS3Path(output.athenaStatus.QueryExecution.ResultConfiguration!.OutputLocation!);

  return ApiResponse.success(<QueryDownload>{
    signedUrl: await s3.getSignedUrlPromise('getObject', {
      Bucket: s3OutputPath.bucket,
      Key: s3OutputPath.key,
      // NOTE: should make this configurable?
      Expires: 12,
    }),
  });
});
