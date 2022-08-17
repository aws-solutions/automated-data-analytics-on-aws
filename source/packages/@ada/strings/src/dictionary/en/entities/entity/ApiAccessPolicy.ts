/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const ApiAccessPolicy: StringEntityDefinition<'ApiAccessPolicy'> = {
	ApiAccessPolicy: 'API Access Policy',
	ApiAccessPolicies: 'API Access Policies',
	api_access_policy: 'access policy',
	api_access_policies: 'access policies',

	description: 'Policy that defines access permissions to the API',
	descriptions: 'Set of policies that define access permission to the API',
}

export default ApiAccessPolicy;

export const ApiAccessPolicy_ = {
	AccessLevel: {
		title: 'Access Level',
	}
} as const;
