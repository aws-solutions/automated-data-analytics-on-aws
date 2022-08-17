/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError, DataProductFileUpload } from '@ada/api';
import { apiGatewayEvent } from '@ada/infra-common/services/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-signed-url';

const mockSignedUrl = jest.fn();
const now = '2021-01-01T00:00:00.000Z';

jest.mock('@ada/aws-sdk', () => ({
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    getSignedUrlPromise: (...args: any[]) => Promise.resolve(mockSignedUrl(...args)),
  })),
}));

// Helper method for calling the handler
const getSignedUrlHandler = (
  { fileName, domainId, dataProductId }: any,
  { contentType, partNumber, uploadId }: any,
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
        uploadId,
        partNumber,
      },
    }),
    null,
  );

describe('get-signed-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  it('should return the signed url in case the execution succeeded', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as DataProductFileUpload;

    expect(mockSignedUrl).toBeCalledWith('putObject', {
      Bucket: 'file-upload-bucket',
      Expires: 60,
      Key: `domain/data-product/file_name.json/file_name.json`,
      ContentType: 'application/json',
    });
    expect(result.statusCode).toBe(200);
    expect(body.signedUrl).toBe('https://any.signed.url/path/to/object');
    expect(body.bucket).toBe('file-upload-bucket');
    expect(body.key).toBe(`domain/data-product/file_name.json/file_name.json`);
  });

  it('should return the signed url for part upload if the uploadId and partNumber are provided', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        partNumber: '1',
        uploadId: 'upload-id',
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as DataProductFileUpload;

    expect(mockSignedUrl).toBeCalledWith('uploadPart', {
      Bucket: 'file-upload-bucket',
      Expires: 60,
      Key: `domain/data-product/file_name.json/file_name.json`,
      UploadId: 'upload-id',
      PartNumber: 1,
    });
    expect(result.statusCode).toBe(200);
    expect(body.signedUrl).toBe('https://any.signed.url/path/to/object');
    expect(body.bucket).toBe('file-upload-bucket');
    expect(body.key).toBe(`domain/data-product/file_name.json/file_name.json`);
  });

  it.each([
    ['1', ''],
    ['1', undefined],
    [undefined, 'upload-id'],
  ])('should return an error if either partNumber and uploadId are provided', async (partNumber, uploadId) => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        partNumber,
        uploadId,
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Missing required parameters, partNumber and uploadId must be provided together.');
  });

  it('should return an error if partNumber is 0', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        partNumber: '0',
        uploadId: 'upload-id',
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('partNumber must be greater than zero');
  });

  it.each([
    ['', ''],
    [undefined, undefined],
    [null, undefined],
    [undefined, 'any'],
  ])('should return an error if any required input parameter is not correct', async (file, content) => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
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

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Missing required parameters, fileName is required');
  });

  it('should return an error if the required input is not provided', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await handler(apiGatewayEvent({}), null);
    const body = JSON.parse(result.body) as ApiError;

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Missing required parameters, fileName is required');
  });

  it('should return an error for unsupported ContentType', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.json',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        partNumber: '0',
        uploadId: 'upload-id',
        contentType: 'unsupported/type',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toContain(`Unsupported file upload for "file_name.json" of type "unsupported/type".`);
  });
  it('should return an error for unsupported file extension', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');

    const result = await getSignedUrlHandler(
      {
        fileName: 'file_name.unsupported',
        domainId: 'domain',
        dataProductId: 'data-product',
      },
      {
        partNumber: '0',
        uploadId: 'upload-id',
        contentType: 'application/json',
      },
    );
    const body = JSON.parse(result.body) as ApiError;

    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toContain(`Unsupported file upload for "file_name.unsupported" of type "application/json".`);
  });
});
