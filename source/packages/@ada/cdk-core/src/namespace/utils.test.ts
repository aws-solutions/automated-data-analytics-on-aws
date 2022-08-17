/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { TEST_GLOBAL_HASH } from './global-uuid';
import { TestStack } from '../testing';
import {
  getSolutionName,
  getUniqueDataProductLogGroupName,
  getUniqueKmsKeyAlias,
  getUniqueName,
  getUniqueStateMachineLogGroupName,
  getUniqueWafFirehoseDeliveryStreamName,
  globalHash,
  pascalCase,
} from './utils';
import { lowerCase } from 'lodash';
import { solutionInfo } from '@ada/common';

const TEST_HASH = '####';

jest.mock('./global-uuid/common', () => ({
  get4DigitsHash: () => TEST_HASH,
}));

describe('namespace', () => {
  const solution = solutionInfo();
  const stack = new TestStack();
  const TEST_ID = 'TestId';
  const construct = new Construct(stack, TEST_ID);

  describe('utils', () => {
    describe('getSolutionName', () => {
      it('should return PascalCase by default', () => {
        expect(getSolutionName()).toBe(pascalCase(solution.name));
      });
      it('should return lowerCase when "lower"', () => {
        expect(getSolutionName('lower')).toBe(lowerCase(solution.name));
      });
    });
    describe('globalHash', () => {
      it('should return literal test hash during testing', () => {
        expect(globalHash(construct)).toBe(TEST_GLOBAL_HASH);
      });
    });
    describe('getUniqueName', () => {
      it('should append node hash + global hash to literal name without separator by default', () => {
        expect(getUniqueName(construct, 'Foo')).toBe(`Foo${TEST_HASH}${TEST_GLOBAL_HASH}`);
      });
      it('should apply separate from options', () => {
        expect(getUniqueName(construct, 'Foo', { separator: '_' })).toBe(`Foo_${TEST_HASH}${TEST_GLOBAL_HASH}`);
      });
      it('should not include node hash if disabled from options', () => {
        expect(getUniqueName(construct, 'Foo', { includeNodeHash: false })).toBe(`Foo${TEST_GLOBAL_HASH}`);
      });
    });
    describe('getUniqueDataProductLogGroupName', () => {
      it('should generate correct log group name from data product', () => {
        expect(getUniqueDataProductLogGroupName(construct, 'service', 'domain1.dataProduct1', 'MyLogGroup')).toBe(
          `/aws/vendedlogs/service/${lowerCase(
            solution.name,
          )}/dataproduct/domain1.dataProduct1/MyLogGroup/${TEST_HASH}${TEST_GLOBAL_HASH}`,
        );
      });
    });
    describe('getUniqueDataProductLogGroupName', () => {
      it('should generate correct log group name from data product', () => {
        expect(getUniqueDataProductLogGroupName(construct, 'service', 'domain1.dataProduct1', 'MyLogGroup')).toBe(
          `/aws/vendedlogs/service/${lowerCase(
            solution.name,
          )}/dataproduct/domain1.dataProduct1/MyLogGroup/${TEST_HASH}${TEST_GLOBAL_HASH}`,
        );
      });
    });
    describe('getUniqueKmsKeyAlias', () => {
      beforeEach(() => {
        process.env.TEST_NAMESPACE_KMSALIAS_DUPLICATES = 'true';
      });
      afterEach(() => {
        delete process.env.TEST_NAMESPACE_KMSALIAS_DUPLICATES;
      });
      it('should generate correct KmsKeyAlias with prefixes', () => {
        expect(getUniqueKmsKeyAlias(construct, 'MyAlias')).toBe(
          `alias/${lowerCase(solution.name)}/MyAlias/${TEST_GLOBAL_HASH}`,
        );
      });
      it('should not allow duplicate names within the tree', () => {
        expect(() => {
          getUniqueKmsKeyAlias(construct, 'MyAlias');
          getUniqueKmsKeyAlias(construct, 'MyAlias');
        }).toThrow('KmsKeyAlias already exists: MyAlias');
      });
    });
    describe('getUniqueWafFirehoseDeliveryStreamName', () => {
      it('should generate correct Firehose WAF destination with required prefixes', () => {
        expect(getUniqueWafFirehoseDeliveryStreamName(construct, 'my-name')).toBe(
          `aws-waf-logs-${lowerCase(solution.name)}-my-name-${TEST_HASH}${TEST_GLOBAL_HASH}`,
        );
      });
    });
    describe('getUniqueStateMachineLogGroupName', () => {
      it('should generate correct state machine log group name with vendedlog prefix to prevent limits', () => {
        expect(getUniqueStateMachineLogGroupName(construct, 'my-name')).toBe(
          `/aws/vendedlogs/states/${lowerCase(solution.name)}/my-name/${TEST_HASH}${TEST_GLOBAL_HASH}`,
        );
      });
    });
  });
});
