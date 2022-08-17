/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Domain: StringEntityDefinition<'Domain'> = {
	Domain: 'Domain',
	Domains: 'Domains',
	domain: 'domain',
	domains: 'domains',

	description: 'Business unit for grouping and managing entities',
	descriptions: 'List of available business units',

	properties: {
		name: {
			label: 'Name',
			description: 'The unique identifier of the domain',
		},
		description: {
			label: 'Description',
			description: 'The description of the domain',
		}
	}
}

export default Domain;
