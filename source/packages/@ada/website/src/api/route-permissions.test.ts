/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { userPermissionsToApiPermissions } from './route-permissions'

describe('api/route-permissions', () => {
	describe('userPermissionsToApiPermissions', () => {
		it('should default when no user permissions provided', () => {
			expect(userPermissionsToApiPermissions()).toEqual({})
		})
		it('should correction map permissions', () => {
			expect(userPermissionsToApiPermissions({
				GetDataProductDomain: { access: true },
				GetQueryResultAsAthena: { access: true },
				DeleteDataProductDomainDataProduct: { access: false },
				ListQueryNamespaceSavedQueries: { access: false },
				PutIdentityRequestAction: { access: true },
			})).toEqual({
				"deleteDataProductDomainDataProduct": false,
				"getDataProductDomain": true,
				"listDataProductDomains": true,
				"listQueryNamespaceSavedQueries": false,
				"listQueryResultsAsAthenaResults": true,
				"putIdentityRequestAction": true,
			})
		})
		it('should throw error for incorrect mapping', () => {
			expect(() => userPermissionsToApiPermissions({
				FooBar: { access: true },
			})).toThrow()
		})
	})
})
