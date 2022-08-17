/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsS3Instance } from '@ada/aws-sdk';
import { DataProductFileUpload } from '@ada/api';
import { validateFileUploadSupportedType } from '@ada/common';

const s3 = AwsS3Instance({ signatureVersion: 'v4' });

/**
 * Handler for retrieving the signed url to be used to upload file
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getDataProductDomainDataProductFileUpload',
  async ({ requestParameters }) => {
    const {
      fileName,
      dataProductId,
      domainId,
      contentType,
      uploadId,
      partNumber: partNumberString,
    } = requestParameters;

    if (!fileName) {
      return ApiResponse.badRequest({
        message: 'Missing required parameters, fileName is required',
      });
    }

    if ((partNumberString && !uploadId) || (uploadId && !partNumberString)) {
      return ApiResponse.badRequest({
        message: 'Missing required parameters, partNumber and uploadId must be provided together.',
      });
    }

    validateFileUploadSupportedType(fileName, contentType);

    const partNumber = Number(partNumberString);
    if (partNumber <= 0) {
      return ApiResponse.badRequest({
        message: 'partNumber must be greater than zero',
      });
    }

    const bucket = process.env.FILE_UPLOAD_BUCKET_NAME;
    const key = `${domainId}/${dataProductId}/${fileName}/${fileName}`;

    return ApiResponse.success(<DataProductFileUpload>{
      signedUrl: await s3.getSignedUrlPromise(uploadId ? 'uploadPart' : 'putObject', {
        Bucket: bucket,
        Key: key,
        // content type can be added only if is not with part number and uploadId
        ...(!uploadId && !partNumber && contentType ? { ContentType: contentType } : {}),
        ...(uploadId && partNumber ? { UploadId: uploadId, PartNumber: partNumber } : {}),
        // NOTE: consider making this configurable
        Expires: 60,
      }),
      bucket,
      key,
    });
  },
);
