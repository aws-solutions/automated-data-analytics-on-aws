/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../validate-s3-path-lambda';

const mockListObjectsV2 = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    listObjectsV2: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListObjectsV2(...args))),
    }),
  })),
}));

describe('validate-s3-path-lambda', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  const mockContents = [
    {
      Key: 'marketing/dataproduct-099/firehose-output/year=2021/month=10/day=06/ada-dp-marketing-dataproduct-099-91fac9f6',
      LastModified: '2021-10-06T22:55:25+00:00',
      ETag: '"146c1c5c2ad06213a308cc58a1e02f6e"',
      Size: 1207061,
      StorageClass: 'STANDARD',
    },
  ];
  const bucketName = 'bucket-01';
  const key = 'marketing/dataproduct-099';

  it('should detect an s3 bucket key exists and is not empty', async () => {
    mockListObjectsV2.mockReturnValueOnce({
      Contents: [mockContents],
      Name: bucketName,
      Prefix: key,
    });

    const result = await handler(
      {
        Payload: {
          bucketName: bucketName,
          key: key,
          attempts: 0,
        },
      },
      null,
    );

    expect(mockListObjectsV2).toHaveBeenCalledWith({
      Bucket: bucketName,
      Prefix: key,
      MaxKeys: 1,
    });

    expect(result.bucketName).toEqual(bucketName);
    expect(result.key).toEqual(key);
    expect(result.hasContents).toEqual(true);
    expect(result.attempts).toEqual(1);
  });
  it('should detect an s3 bucket key is empty', async () => {
    mockListObjectsV2.mockReturnValueOnce({
      Name: bucketName,
      Prefix: key,
    });

    const result = await handler(
      {
        Payload: {
          bucketName: bucketName,
          key: key,
          attempts: 0,
        },
      },
      null,
    );

    expect(mockListObjectsV2).toHaveBeenCalledWith({
      Bucket: bucketName,
      Prefix: key,
      MaxKeys: 1,
    });

    expect(result.bucketName).toEqual(bucketName);
    expect(result.key).toEqual(key);
    expect(result.hasContents).toEqual(false);
    expect(result.attempts).toEqual(1);
  });
});
