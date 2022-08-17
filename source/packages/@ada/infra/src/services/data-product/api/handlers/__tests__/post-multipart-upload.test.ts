/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError, DataProductMultipartFileUploadStarted } from '@ada/api';
import { apiGatewayEvent } from '@ada/infra-common/services/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../post-multipart-upload';

const mockedCreateMultipartUplaod = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    createMultipartUpload: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockedCreateMultipartUplaod(...args))),
    }),
  })),
}));

// Helper method for calling the handler
const postMultipartUploadHandler = (
  { fileName, domainId, dataProductId }: any,
  { contentType }: any,
): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      pathParameters: {
        fileName,
        domainId,
        dataProductId,
      },
      queryStringParameters: {
        contentType,
      },
    }),
    null,
  );

describe('post-multipart-upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the uploadId in case the execution succeeded', async () => {
    mockedCreateMultipartUplaod.mockReturnValue({
      UploadId: 'an-upload-id',
    });

    const result = await postMultipartUploadHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as DataProductMultipartFileUploadStarted;

    expect(mockedCreateMultipartUplaod).toBeCalledWith({
      Bucket: 'file-upload-bucket',
      Key: 'domain/data-product/file_name.json/file_name.json',
      ContentType: 'application/json',
    });
    expect(result.statusCode).toBe(200);
    expect(body.uploadId).toBe('an-upload-id');
    expect(body.bucket).toBe('file-upload-bucket');
    expect(body.key).toBe('domain/data-product/file_name.json/file_name.json');
  });

  it.each([
    ['', ''],
    [undefined, undefined],
    [null, undefined],
    [undefined, 'any'],
    ['any', undefined],
  ])('should return an error if any required input parameter is not correct', async (file, content) => {
    mockedCreateMultipartUplaod.mockReturnValue({
      UploadId: 'an-upload-id',
    });

    const result = await postMultipartUploadHandler(
      {
        fileName: file,
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        contentType: content,
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockedCreateMultipartUplaod).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Missing required parameters. Both fileName and contentType must be provided');
  });

  it('should return an error for unsupported ContentType', async () => {
    const result = await postMultipartUploadHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        contentType: 'unsupported/type',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(result.statusCode).toBe(400);
    expect(body.message).toContain(`Unsupported file upload for "file_name.json" of type "unsupported/type".`);
  });

  it('should return an error for unsupported file extension', async () => {
    const result = await postMultipartUploadHandler(
      {
        fileName: 'file_name.unsupported',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(result.statusCode).toBe(400);
    expect(body.message).toContain(`Unsupported file upload for "file_name.unsupported" of type "application/json".`);
  });
});
