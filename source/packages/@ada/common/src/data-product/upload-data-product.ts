/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as mime from 'mime-types';
import { last } from 'lodash';
export interface MultipartUploadPart {
  etag: string;
  partNumber: number;
}

export function getContentTypeForFile(file: string, defaultType?: string): string {
  return mime.lookup(file) || defaultType || 'application/octet-stream';
}

/**
 * List of file extensions supported by file upload data product.
 *
 * This is a subset of extensions supported by Glue that we can handle in the preview.
 *
 * @see https://docs.aws.amazon.com/databrew/latest/dg/supported-data-file-sources.html
 */
export const FILEUPLOAD_SUPPORTED_EXTENSIONS = ['.parquet', '.json', '.csv', '.gz'];

export const FILEUPLOAD_SUPPORTED_CONTENTTYPES = FILEUPLOAD_SUPPORTED_EXTENSIONS.map((extension) => {
  return getContentTypeForFile(extension);
});

export function isFileUploadSupported(fileName: string, contentType: string): boolean {
  return (
    FILEUPLOAD_SUPPORTED_CONTENTTYPES.includes(contentType) &&
    FILEUPLOAD_SUPPORTED_EXTENSIONS.includes('.' + last(last(fileName.split('/'))?.split('.')) || '')
  );
}

export function validateFileUploadSupportedType(fileName: string, contentType: string): void {
  if (!isFileUploadSupported(fileName, contentType)) {
    throw new Error(`Unsupported file upload for "${fileName}" of type "${contentType}".`);
  }
}
