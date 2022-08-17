/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsS3Instance } from '@ada/aws-sdk';
import { DataProductMultipartFileUploadStarted } from '@ada/api';
import { validateFileUploadSupportedType } from '@ada/common';

const s3 = AwsS3Instance({ signatureVersion: 'v4' });

/**
 * Handler for starting the multipart upload proccess
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'postDataProductDomainDataProductFileUpload',
  async ({ requestParameters }, _callingUser, _event, { log }) => {
    const { fileName, dataProductId, domainId, contentType } = requestParameters;

    if (!fileName || !contentType) {
      return ApiResponse.badRequest({
        message: 'Missing required parameters. Both fileName and contentType must be provided',
      });
    }

    validateFileUploadSupportedType(fileName, contentType);

    log.info(`Starting upload for filename: ${fileName} with contentType: ${contentType}`);

    const bucket = process.env.FILE_UPLOAD_BUCKET_NAME!;
    const key = `${domainId}/${dataProductId}/${fileName}/${fileName}`;
    log.debug(`Starting upload for bucket and key`, { bucket, key });
    const multipart = await s3
      .createMultipartUpload({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      })
      .promise();

    return ApiResponse.success(<DataProductMultipartFileUploadStarted>{
      uploadId: multipart.UploadId,
      bucket,
      key,
    });
  },
  ApiLambdaHandler.doNotLockPrimaryEntity,
);
