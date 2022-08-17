/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DEFAULT_S3_SOURCE_DATA_PRODUCT, apiGatewayEvent } from '@ada/microservice-test-common';
import { DataProduct } from '@ada/api-client';
import { handler } from '../post-data-product-preview';

const mockEncrypt = jest.fn();
const mockStartExecution = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    startExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartExecution(...args))),
    }),
  })),
  AwsKMSInstance: jest.fn().mockImplementation(() => ({
    encrypt: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockEncrypt(...args))),
    }),
  })),
}));

describe('post-data-product-preview', () => {
  const prevKeyId = process.env.KEY_ID;

  beforeEach(() => {
    process.env.KEY_ID = 'kms-key';
  });

  afterEach(() => {
    process.env.KEY_ID = prevKeyId;
  });

  const postPreviewHandler = (dataProduct: DataProduct) =>
    handler(
      apiGatewayEvent({
        pathParameters: { domainId: dataProduct.domainId, dataProductId: dataProduct.dataProductId },
        body: JSON.stringify(dataProduct),
      }),
      null,
    );

  it('should start the preview state machine', async () => {
    const sourceDetailsEncrypted = Buffer.from('test-encrypted-output');
    mockStartExecution.mockReturnValue({
      executionArn: 'arn:aws:states:us-test-2:012345678910:execution:Preview:my-preview-id',
    });
    mockEncrypt.mockReturnValue({
      CiphertextBlob: sourceDetailsEncrypted,
    });

    const response = await postPreviewHandler(DEFAULT_S3_SOURCE_DATA_PRODUCT);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ previewId: 'my-preview-id' });

    expect(mockStartExecution).toHaveBeenCalledWith({
      stateMachineArn: process.env.DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN,
      input: JSON.stringify({
        Payload: {
          dataProduct: {
            ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
            sourceDetails: sourceDetailsEncrypted.toString('base64'),
          },
          sampleSize: 10,
          callingUser: {
            userId: 'test-user',
            username: 'test-user@usr.example.com',
            groups: ['admin', 'analyst'],
          },
        },
      }),
    });
    expect(mockEncrypt).toHaveBeenCalledWith({
      KeyId: 'kms-key',
      Plaintext: JSON.stringify(DEFAULT_S3_SOURCE_DATA_PRODUCT.sourceDetails),
    });
  });
});
