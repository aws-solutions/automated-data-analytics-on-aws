/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  FILEUPLOAD_SUPPORTED_CONTENTTYPES,
  FILEUPLOAD_SUPPORTED_EXTENSIONS,
  isFileUploadSupported,
  validateFileUploadSupportedType,
} from './upload-data-product';

describe('data-product/upload-data-product', () => {
  describe('isFileUploadSupported', () => {
    it.each(FILEUPLOAD_SUPPORTED_EXTENSIONS)('should support %s extension', async (extension) => {
      expect(isFileUploadSupported(`foo${extension}`, 'application/json')).toBeTruthy();
    });
    it.each(FILEUPLOAD_SUPPORTED_CONTENTTYPES)('should support %s content type', async (contentType) => {
      expect(isFileUploadSupported('foo.json', contentType)).toBeTruthy();
    });

    it('should handle nested file paths', () => {
      expect(isFileUploadSupported('/bar/baz/foo.json', 'application/json')).toBeTruthy();
    });
    it('should handle root file path', () => {
      expect(isFileUploadSupported('foo.json', 'application/json')).toBeTruthy();
    });

    it('should detect invalid extension', () => {
      expect(isFileUploadSupported('foo.unsupported', 'application/json')).toBeFalsy();
    });
    it('should detect invalid content type', () => {
      expect(isFileUploadSupported('foo.json', 'unsupported/type')).toBeFalsy();
    });
    it('should fail for file without extension', () => {
      expect(isFileUploadSupported('foo', 'application/json')).toBeFalsy();
    });
    it('should fail for empty content type', () => {
      expect(isFileUploadSupported('foo.json', '')).toBeFalsy();
    });
  });
  describe('validateFileUploadSupportedType', () => {
    it.each(FILEUPLOAD_SUPPORTED_EXTENSIONS)('should support %s extension', async (extension) => {
      expect(() => validateFileUploadSupportedType(`foo${extension}`, 'application/json')).not.toThrow();
    });
    it.each(FILEUPLOAD_SUPPORTED_CONTENTTYPES)('should support %s content type', async (contentType) => {
      expect(() => validateFileUploadSupportedType('foo.json', contentType)).not.toThrow();
    });

    it('should throw error for invalid extension', () => {
      expect(() => validateFileUploadSupportedType('foo.unsupported', 'application/json')).toThrow();
    });
    it('should throw error for invalid content type', () => {
      expect(() => validateFileUploadSupportedType('foo.json', 'unsupported/type')).toThrow();
    });
  });
});
