/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API, ApiOperationRequest } from '@ada/api-client/mock';
import { MultiPartFileUploader } from '../multipart-file-uploader';
import mockAxios from 'jest-mock-axios';

jest.mock('axios');
jest.mock('@ada/api-client');

const VALID_FILENAME = 'mock.json';
const VALID_CONTENTTYPE = 'application/json';

describe('multipart-file-uploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload multiple chunks based on the file-size', async () => {
    const onProgressHandler = jest.fn();

    API.postDataProductDomainDataProductFileUpload.mockResolvedValue({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
      uploadId: 'an-upload-id',
    });
    API.putDataProductDomainDataProductFileUpload.mockResolvedValue({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
    });
    API.getDataProductDomainDataProductFileUpload.mockResolvedValueOnce({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
      signedUrl: 'signed-url-1',
    });
    API.getDataProductDomainDataProductFileUpload.mockResolvedValueOnce({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
      signedUrl: 'signed-url-2',
    });
    mockAxios.put.mockResolvedValueOnce({
      status: 200,
      headers: {
        etag: 'tag1',
      },
    });
    mockAxios.put.mockResolvedValueOnce({
      status: 200,
      headers: {
        etag: 'tag2',
      },
    });

    const file: any = {
      type: VALID_CONTENTTYPE,
      name: VALID_FILENAME,
      size: 80 * 1024 * 1024,
      slice: jest
        .fn()
        .mockReturnValueOnce(new Blob(['blob-1']))
        .mockReturnValueOnce(new Blob(['blob-2'])),
    };
    const multiFileUpload = new MultiPartFileUploader(file, 'data-product-id', 'domain-id');
    multiFileUpload.onProgress(onProgressHandler);

    await multiFileUpload.startUpload();

    expect(API.postDataProductDomainDataProductFileUpload).toHaveBeenCalledTimes(1);
    expect(API.postDataProductDomainDataProductFileUpload).toHaveBeenCalledWith<
      [ApiOperationRequest<'postDataProductDomainDataProductFileUpload'>]
    >({
      contentType: file.type,
      fileName: file.name,
      dataProductId: 'data-product-id',
      domainId: 'domain-id',
    });
    expect(API.getDataProductDomainDataProductFileUpload).toHaveBeenCalledTimes(2);
    expect(API.getDataProductDomainDataProductFileUpload).nthCalledWith<
      [ApiOperationRequest<'getDataProductDomainDataProductFileUpload'>]
    >(1, {
      dataProductId: 'data-product-id',
      domainId: 'domain-id',
      contentType: file.type,
      fileName: file.name,
      uploadId: 'an-upload-id',
      partNumber: 1,
    });
    expect(API.getDataProductDomainDataProductFileUpload).nthCalledWith<
      [ApiOperationRequest<'getDataProductDomainDataProductFileUpload'>]
    >(2, {
      dataProductId: 'data-product-id',
      domainId: 'domain-id',
      contentType: file.type,
      fileName: file.name,
      uploadId: 'an-upload-id',
      partNumber: 2,
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(2);
    expect(mockAxios.put).nthCalledWith(1, 'signed-url-1', expect.any(Blob), expect.anything());
    expect(mockAxios.put).nthCalledWith(2, 'signed-url-2', expect.any(Blob), expect.anything());
    expect(API.putDataProductDomainDataProductFileUpload).toHaveBeenCalledTimes(1);
    expect(API.putDataProductDomainDataProductFileUpload).toHaveBeenCalledWith<
      [ApiOperationRequest<'putDataProductDomainDataProductFileUpload'>]
    >({
      dataProductId: 'data-product-id',
      domainId: 'domain-id',
      fileName: file.name,
      uploadId: 'an-upload-id',
      fileUploadInput: {
        parts: [
          expect.objectContaining({ etag: 'tag1', partNumber: 1 }),
          expect.objectContaining({ etag: 'tag2', partNumber: 2 }),
        ],
      },
    });
    expect(onProgressHandler).toHaveBeenCalled();
  });

  it('should throw error if any chunk fails', async () => {
    const onProgressHandler = jest.fn();

    API.postDataProductDomainDataProductFileUpload.mockResolvedValue({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
      uploadId: 'an-upload-id',
    });
    API.putDataProductDomainDataProductFileUpload.mockResolvedValue({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
    });
    API.getDataProductDomainDataProductFileUpload.mockResolvedValueOnce({
      bucket: 'a-bucket',
      key: VALID_FILENAME,
      signedUrl: 'signed-url-1',
    });
    API.getDataProductDomainDataProductFileUpload.mockRejectedValueOnce({
      any: 'error',
    });
    mockAxios.put.mockResolvedValueOnce({
      status: 403,
    });
    mockAxios.put.mockResolvedValueOnce({
      status: 200,
      headers: {
        etag: 'tag2',
      },
    });

    const file: any = {
      type: VALID_CONTENTTYPE,
      name: VALID_FILENAME,
      size: 80 * 1024 * 1024,
      slice: jest
        .fn()
        .mockReturnValueOnce(new Blob(['blob-1']))
        .mockReturnValueOnce(new Blob(['blob-2'])),
    };
    const multiFileUpload = new MultiPartFileUploader(file, 'data-product-id', 'domain-id');
    multiFileUpload.onProgress(onProgressHandler);

    await expect(multiFileUpload.startUpload()).rejects.toThrow();
  });
});
