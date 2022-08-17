/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EntityKey, STRING_ENTITY_ACTIONS, STRING_ENTITY_EVENTS, toPluralKey } from './dictionary/en/entities/types'
import { LL, getLLStringFunction } from './index'
import { snakeCase } from 'lodash';

describe('@ada/strings', () => {
	describe('ENTITY', () => {
		describe.each(Object.values(EntityKey))('%s', (entityKey) => {
			const SingularKey = entityKey;
			const singular_key = snakeCase(SingularKey);
			const PluralKey = toPluralKey(entityKey);
			const plural_key = snakeCase(PluralKey);

			const SingularValue = LL.ENTITY[SingularKey]();
			const singular_value = LL.ENTITY[singular_key]();
			const PluralValue = LL.ENTITY[PluralKey]();
			const plural_value = LL.ENTITY[plural_key]();

			it('should have singular and plural strings defined', () => {
				expect(SingularValue).toBeDefined();
				expect(singular_value).toBeDefined();
				expect(PluralValue).toBeDefined();
				expect(plural_value).toBeDefined();
			})

			it('should have "named" entity strings', () => {
				expect(LL.ENTITY[SingularKey + '^']('Name')).toBe(`Name ${SingularValue}`);
				expect(LL.ENTITY[singular_key + '^']('Name')).toBe(`Name ${singular_value}`);
			})

			describe('count', () => {
				it('should have count name', () => {
					expect(LL.ENTITY[PluralKey + '$'](0)).toBe(SingularValue);
					expect(LL.ENTITY[PluralKey + '$'](1)).toBe(SingularValue);
					expect(LL.ENTITY[PluralKey + '$'](2)).toBe(PluralValue);
				})
				it('should have count value', () => {
					expect(LL.ENTITY[PluralKey + '#'](2)).toBeDefined();
				})
				it('should have lower count name', () => {
					expect(LL.ENTITY[plural_key + '$'](0)).toBe(singular_value);
					expect(LL.ENTITY[plural_key + '$'](1)).toBe(singular_value);
					expect(LL.ENTITY[plural_key + '$'](2)).toBe(plural_value);
				})
				it('should have lower count value', () => {
					expect(LL.ENTITY[plural_key + '#'](0)).toBe(`0 ${plural_value}`);
					expect(LL.ENTITY[plural_key + '#'](1)).toBe(`1 ${singular_value}`);
					expect(LL.ENTITY[plural_key + '#'](2)).toBe(`2 ${plural_value}`);
				})
			})

			describe('actions', () => {
				it.each(STRING_ENTITY_ACTIONS)('%s', (action) => {
					expect(LL.ENTITY[`${SingularKey}__${action}`]()).not.toMatch(' "Name"');
					expect(LL.ENTITY[`${SingularKey}__${action}`]('Name')).toMatch(' "Name"');
					expect(LL.ENTITY[`${PluralKey}__${action}`]()).not.toMatch(' "Name"');
					expect(LL.ENTITY[`${PluralKey}__${action}`]('Name')).toMatch(' "Name"');
				})
			})

			describe('events', () => {
				it.each(STRING_ENTITY_EVENTS)('%s', (event) => {
					expect(LL.ENTITY[`${SingularKey}__${event}`]()).not.toMatch(' "Name"');
					expect(LL.ENTITY[`${SingularKey}__${event}`]('Name')).toMatch(' "Name"');
					expect(LL.ENTITY[`${PluralKey}__${event}`]()).not.toMatch(' "Name"');
					expect(LL.ENTITY[`${PluralKey}__${event}`]('Name')).toMatch(' "Name"');
				})
			})
		});
	})

	describe('utils', () => {
		describe('getLLStringFunction', () => {
			it('should get string function from dot path with no args', () => {
				expect(getLLStringFunction('VIEW.misc.retry')())
				.toBe(LL.VIEW.misc.retry())
			})
			it('should get string function from dot path with args', () => {
				expect(getLLStringFunction('VIEW.misc.seeAll')('Foo'))
				.toBe(LL.VIEW.misc.seeAll('Foo'))
			})
		})
	})
})
