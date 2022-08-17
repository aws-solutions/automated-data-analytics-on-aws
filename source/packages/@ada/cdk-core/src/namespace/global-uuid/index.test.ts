/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { App, NestedStack, Stack, Token } from 'aws-cdk-lib';
import { NamespaceGlobalUUID } from './index';

const STORED_HASH = 'stored-hash';

describe('namespace', () => {
  describe('NamespaceGlobalUUID', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'not_test';
    });
    afterAll(() => {
      process.env.NODE_ENV = 'test';
    });

    const app = new App();
    const stack = new Stack(app, 'MyStack');
    const instance = new NamespaceGlobalUUID(stack);

    it('should get uuid reference for attached stack', () => {
      expect(NamespaceGlobalUUID.globalHash(stack)).toBe(instance.uuid);
    });

    it('should get stored property when defined', () => {
      const otherStack = new Stack(app, 'OtherStack');
      NamespaceGlobalUUID.storeGlobalHash(otherStack, STORED_HASH);
      expect(NamespaceGlobalUUID.globalHash(otherStack)).toBe(STORED_HASH);
    });
    it('should get lazy string when no reference available', () => {
      const otherStack = new Stack(app, 'OtherStack2');

      // before defined should return lazy string token
      const globalHash = NamespaceGlobalUUID.globalHash(otherStack);
      expect(globalHash).not.toBe(instance.uuid);
      expect(Token.isUnresolved(globalHash)).toBe(true);

      // before defined it should throw error
      expect(() => otherStack.resolve(globalHash)).toThrow();

      // after defined should resolve to stored value
      NamespaceGlobalUUID.storeGlobalHash(otherStack, STORED_HASH);
      const resolved = otherStack.resolve(globalHash);
      expect(resolved).toBe(STORED_HASH);
    });

    it('should only be attachable to root stack', () => {
      const resource = new NestedStack(stack, 'MyNestedStack');
      expect(() => new NamespaceGlobalUUID(resource)).toThrow();
    });
  });
});
