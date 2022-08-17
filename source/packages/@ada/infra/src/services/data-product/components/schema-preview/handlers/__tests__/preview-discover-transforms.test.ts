/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BuiltInTransforms } from '@ada/transforms';
import { DEFAULT_CALLER, DEFAULT_S3_SOURCE_DATA_PRODUCT } from '@ada/microservice-test-common';
import { DiscoverPreviewTransformsInput, handler } from '../preview-discover-transforms';
import { ReservedDomains } from '@ada/common';
import { ScriptBucket } from '../../../s3/script';

const mockGetObject = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    getObject: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetObject(...args))),
    }),
  })),
}));

describe('preview-discover-transforms', () => {
  const getScript = jest.fn().mockReturnValue({ scriptContent: 'script content!' });
  const prevTempBucketName = process.env.TEMP_BUCKET_NAME;
  beforeEach(() => {
    jest.spyOn(ScriptBucket, 'getInstance').mockReturnValue({
      getScript,
    } as any);
    process.env.TEMP_BUCKET_NAME = 'temp-bucket';
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env.TEMP_BUCKET_NAME = prevTempBucketName;
  });

  const previewDiscoverTransforms = (Payload: DiscoverPreviewTransformsInput) =>
    handler(
      {
        Payload,
      },
      null,
    );

  it('should discover the transforms for the data product and load their script content', async () => {
    const result = await previewDiscoverTransforms({
      sampleSize: 10,
      dataProduct: {
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        domainId: 'domain',
        dataProductId: 'data-product',
        transforms: [{ namespace: 'test', scriptId: 'my-script' }],
        enableAutomaticTransforms: true,
        sourceDetails: 'encrypted-source-details',
      },
      tableDetails: [
        {
          tableName: 'sampleTable',
          classification: 'json',
          sampleDataS3Path: 's3://sample/data.json',
          originalDataS3Path: 's3://original/data/',
        },
      ],
      callingUser: DEFAULT_CALLER,
    });

    expect(result.orderedTransforms).toEqual([
      {
        scriptId: BuiltInTransforms.ada_json_relationalise.id,
        namespace: ReservedDomains.GLOBAL,
        scriptContent: 'script content!',
        tempS3Path: expect.stringContaining(`s3://${process.env.TEMP_BUCKET_NAME}/domain/data-product/`),
      },
      {
        scriptId: 'my-script',
        namespace: 'test',
        scriptContent: 'script content!',
        tempS3Path: expect.stringContaining(`s3://${process.env.TEMP_BUCKET_NAME}/domain/data-product/`),
      },
    ]);
  });

  it('should load inline transforms', async () => {
    const result = await previewDiscoverTransforms({
      sampleSize: 10,
      dataProduct: {
        ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
        domainId: 'domain',
        dataProductId: 'data-product',
        transforms: [{ namespace: 'test', scriptId: 'my-script', inlineScriptContent: 'local script content!' }],
        enableAutomaticTransforms: false,
        sourceDetails: 'encrypted-source-details',
      },
      tableDetails: [
        {
          tableName: 'sampleTable',
          classification: 'csv',
          sampleDataS3Path: 's3://sample/data.csv',
          originalDataS3Path: 's3://original/data/',
        },
      ],
      callingUser: DEFAULT_CALLER,
    });

    expect(result.orderedTransforms).toEqual([
      {
        scriptId: 'my-script',
        namespace: 'test',
        scriptContent: 'local script content!',
        tempS3Path: expect.stringContaining(`s3://${process.env.TEMP_BUCKET_NAME}/domain/data-product/`),
      },
    ]);

    expect(getScript).not.toHaveBeenCalled();
  });
});
