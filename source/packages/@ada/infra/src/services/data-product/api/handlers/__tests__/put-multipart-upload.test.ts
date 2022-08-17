/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError, S3Location } from '@ada/api';
import { MultipartUploadPartRequest, handler } from '../put-multipart-upload';
import { apiGatewayEvent } from '@ada/infra-common/services/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockedCompleteMultipartUplaod = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    completeMultipartUpload: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockedCompleteMultipartUplaod(...args))),
    }),
  })),
}));

// Helper method for calling the handler
const postMultipartUploadHandler = (
  { fileName, domainId, dataProductId }: any,
  { uploadId }: any,
  body: MultipartUploadPartRequest,
): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      pathParameters: {
        fileName,
        domainId,
        dataProductId,
      },
      queryStringParameters: {
        uploadId,
      },
      body: JSON.stringify(body),
    }),
    null,
  );

describe('put-multipart-upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the expected results in case of success', async () => {
    mockedCompleteMultipartUplaod.mockReturnValue({});

    const result = await postMultipartUploadHandler(
      {
        fileName: 'file_name.ext',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        uploadId: 'an-upload-id',
      },
      {
        parts: [{ etag: 'a-tag', partNumber: 1 }],
      },
    );
    const body = JSON.parse(result.body) as S3Location;

    expect(mockedCompleteMultipartUplaod).toBeCalledWith({
      Bucket: 'file-upload-bucket',
      Key: 'domain/data-product/file_name.ext/file_name.ext',
      UploadId: 'an-upload-id',
      MultipartUpload: {
        Parts: [
          {
            ETag: 'a-tag',
            PartNumber: 1,
          },
        ],
      },
    });
    expect(result.statusCode).toBe(200);
    expect(body.bucket).toBe('file-upload-bucket');
    expect(body.key).toBe('domain/data-product/file_name.ext/file_name.ext');
  });

  it.each([
    ['', '', ''],
    [undefined, undefined, undefined],
    [null, undefined, []],
    [undefined, 'any', []],
    ['any', undefined, []],
  ])('should return an error if any required input parameter is not correct', async (file, uploadId, parts) => {
    mockedCompleteMultipartUplaod.mockReturnValue({});

    const result = await postMultipartUploadHandler(
      {
        fileName: file,
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        uploadId,
      },
      {
        parts,
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockedCompleteMultipartUplaod).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Missing required parameters, fileName uploadId and parts must be provided');
  });

  it.each([[{ etag: '', partNumber: 1 }], [{ etag: 'a-tag', partNumber: 0 }]])(
    'should return an error if any parts in the body is missing required values',
    async (part) => {
      mockedCompleteMultipartUplaod.mockReturnValue({});

      const result = await postMultipartUploadHandler(
        {
          fileName: 'file',
          domainId: 'domain',
          dataProductId: 'data-product',
        },
        {
          uploadId: 'an-upload',
        },
        {
          parts: [part],
        },
      );
      const body = JSON.parse(result.body) as ApiError;

      expect(mockedCompleteMultipartUplaod).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(400);
      expect(body.message).toBe('The parts array contains some items with missing etag or partNumber');
    },
  );
});
