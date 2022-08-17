/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { OperationEntityMeta, getEntityKeyFromParam, getOperationAction, getOperationMeta } from './api-meta'

describe('api/extended-client/types', () => {
	describe('api-meta', () => {
		it('should define OperationEntityMeta', () => {
			expect(OperationEntityMeta).toBeDefined();
		})

		describe('getOperationAction', () => {
			it('should retrieve "get" operation action', () => {
				// @ts-ignore
				expect(getOperationAction('getFooOperation')).toBe('get')
			})
			it('should retrieve "post" operation action', () => {
				// @ts-ignore
				expect(getOperationAction('postFooOperation')).toBe('post')
			})
			it('should retrieve "put" operation action', () => {
				// @ts-ignore
				expect(getOperationAction('putFooOperation')).toBe('put')
			})
			it('should retrieve "delete" operation action', () => {
				// @ts-ignore
				expect(getOperationAction('deleteFooOperation')).toBe('delete')
			})
			it('should retrieve "list" operation action', () => {
				// @ts-ignore
				expect(getOperationAction('listFooOperation')).toBe('list')
			})
			it('should throw on unsupported action', () => {
				// @ts-ignore
				expect(() => getOperationAction('unsupportedOperationName')).toThrow()
			})
		})

		describe('getOperationMeta', () => {
			it('should handle entity query operation', () => {
				// @ts-ignore
				expect(getOperationMeta('getDataProductDomain')).toEqual({
					"action": "get",
					"entityKey": [
						"domainId",
					],
					"key": "DataProductDomain",
					"listKey": "domains",
					"name": "getDataProductDomain",
					"paginated": false,
					"type": "QUERY",
				})
			})
			it('should handle entity mutation operation', () => {
				// @ts-ignore
				expect(getOperationMeta('putDataProductDomain')).toEqual({
					"action": "put",
					"entityKey": [
						"domainId",
					],
					"key": "DataProductDomain",
					"listKey": "domains",
					"name": "putDataProductDomain",
					"paginated": false,
					"type": "MUTATION",
				})
			})
			it('should handle paginated operation', () => {
				// @ts-ignore
				expect(getOperationMeta('listDataProductDomains')).toEqual({
					"action": "list",
					"entityKey": [
						"domainId",
					],
					"key": "DataProductDomain",
					"listKey": "domains",
					"name": "listDataProductDomains",
					"paginated": true,
					"type": "QUERY",
				})
			})
			it('should handle non-entity operation', () => {
				// @ts-ignore
				expect(getOperationMeta('getNonEntityOperation')).toEqual({
					"action": "get",
					"key": "NonEntityOperation",
					"name": "getNonEntityOperation",
					"paginated": false,
					"type": "QUERY",
				})
			})

			it('should throw on unsupported operation', () => {
				// @ts-ignore
				expect(() => getOperationMeta('unsupportedOperationName')).toThrow()
			})
		})
	})

	describe('getEntityKeyFromParam', () => {
		it('should handle single entity key', () => {
			expect(getEntityKeyFromParam(['foo'], { foo: 'FOO-VALUE' })).toEqual(['FOO-VALUE'])
		})
		it('should handle double entity key', () => {
			expect(getEntityKeyFromParam(['foo', 'bar'], { foo: 'FOO-VALUE', bar: 'BAR-VALUE' })).toEqual(['FOO-VALUE', 'BAR-VALUE'])
		})
	})
})
