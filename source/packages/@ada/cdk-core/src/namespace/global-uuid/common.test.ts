/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { get4DigitsHash, getFriendlyHash } from './common';

describe('namespace/global-uuid/common', () => {
  describe('get4DigitsHash', () => {
    it('should generate consistent hashing', () => {
      expect(get4DigitsHash('foo')).toBe(get4DigitsHash('foo'));
    });
    it('should generate consistent hashing with salt applied', () => {
      expect(get4DigitsHash('foo', 'thesalt')).toBe(get4DigitsHash('foo', 'thesalt'));
    });
  });
  describe('getFriendlyHash', () => {
    it('should generate consistent friendly name', () => {
      expect(getFriendlyHash('foo')).toBe('foo3085');
      expect(getFriendlyHash('foo')).toBe(getFriendlyHash('foo'));
    });
    it('should generate consistent friendly name with truncation', () => {
      expect(getFriendlyHash('foo123456789', 3)).toBe('foo5586');
      expect(getFriendlyHash('foo123456789', 3)).toBe(getFriendlyHash('foo123456789', 3));
    });
    it('should generate consistent friendly name with truncation', () => {
      expect(getFriendlyHash('foo123456789', 3)).toBe('foo5586');
      expect(getFriendlyHash('foo123456789', 3)).toBe(getFriendlyHash('foo123456789', 3));
    });
  });
});
