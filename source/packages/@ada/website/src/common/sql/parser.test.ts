/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { isValidSQL, parseSQL } from './parser';

describe('common/sql/parser', () => {
	describe('isValidSQL', () => {
		it('should parse valid sql', () => {
			expect(isValidSQL('SELECT * FROM test WHERE bar = "foo"')).toBeTruthy();
		})

		it('should fail to parse invalid sql', () => {
			expect(isValidSQL('//INVALID')).toBe(false);
		})
	})
	describe('parseSQL', () => {
		it('should parse valid sql', () => {
			expect(parseSQL('SELECT * FROM test WHERE bar = "foo"')).toBeDefined();
		})

		it('should fail to parse invalid sql', () => {
			expect(() => parseSQL('//INVALID')).toThrow();
		})
	})
})
