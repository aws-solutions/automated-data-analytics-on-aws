/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsS3Instance } from '@ada/aws-sdk';
import { MultipartUploadPart } from '@ada/common';
import { S3Location } from '@ada/api';

const s3 = AwsS3Instance({ signatureVersion: 'v4' });

export interface MultipartUploadPartRequest {
  parts: MultipartUploadPart[];
}

/**
 * Handler for completing the multipart upload proccess
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putDataProductDomainDataProductFileUpload',
  async ({ requestParameters, body: { parts } }, _callingUser, _event, { log }) => {
    const { fileName, dataProductId, domainId, uploadId } = requestParameters;

    if (!fileName || !uploadId || !parts || parts.length === 0) {
      return ApiResponse.badRequest({
        message: 'Missing required parameters, fileName uploadId and parts must be provided',
      });
    }
    log.info(`Starting complete upload for file ${fileName} and uploadId: ${uploadId}`);

    if (parts.some((q) => !q.etag || !q.partNumber)) {
      return ApiResponse.badRequest({
        message: 'The parts array contains some items with missing etag or partNumber',
      });
    }

    const bucket = process.env.FILE_UPLOAD_BUCKET_NAME!;
    const key = `${domainId}/${dataProductId}/${fileName}/${fileName}`;

    await s3
      .completeMultipartUpload({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part: MultipartUploadPart) => ({
            ETag: part.etag,
            PartNumber: part.partNumber,
          })),
        },
      })
      .promise();

    return ApiResponse.success(<S3Location>{
      bucket,
      key,
    });
  },
  ApiLambdaHandler.doNotLockPrimaryEntity,
);
