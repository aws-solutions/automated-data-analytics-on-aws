/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { initFormatters } from './formatters';

const formatters = initFormatters('en');

describe('strings/formatter', () => {
  describe('casing', () => {
    it('camelCase', () => {
      expect(formatters.camelcase('Foo Bar Baz')).toBe('fooBarBaz');
    });
    it('kebabcase', () => {
      expect(formatters.kebabcase('Foo Bar Baz')).toBe('foo-bar-baz');
    });
    it('lowercase', () => {
      expect(formatters.lowercase('Foo Bar Baz')).toBe('foo bar baz');
    });
    it('snakecase', () => {
      expect(formatters.snakecase('Foo Bar Baz')).toBe('foo_bar_baz');
    });
    it('startcase', () => {
      expect(formatters.startcase('Foo Bar Baz')).toBe('Foo Bar Baz');
    });
    it('uppercase', () => {
      expect(formatters.uppercase('Foo Bar Baz')).toBe('FOO BAR BAZ');
    });
  });

  describe('entity', () => {
    it('entityIdentifier', () => {
      expect(formatters.entityIdentifier('Foo Bar Baz')).toBe('foo_bar_baz');
    });
    it('entityName', () => {
      expect(formatters.entityName('foo_bar_baz')).toBe('Foo Bar Baz');
    });
  });

  describe('mask', () => {
    it('mask', () => {
      expect(formatters.mask('sensitive test to mask')).toBe('**********');
    });
    it('mask5', () => {
      expect(formatters.mask5('sensitive test to mask')).toBe('sensit****');
    });
    it('mask5 empty', () => {
      expect(formatters.mask5(undefined as any)).toBe('**********');
    });
  });

  describe('quote', () => {
    it('quote', () => {
      expect(formatters.quote('value')).toBe('"value"')
    });
    it('quote empty', () => {
      expect(formatters.quote(undefined as any)).toBe('');
    });
  });
});
