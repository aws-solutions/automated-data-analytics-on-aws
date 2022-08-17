/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition, StringEntityProperty } from '../types'

export const IdentityProvider: StringEntityDefinition<'IdentityProvider'> = {
	IdentityProvider: 'Identity Provider',
	IdentityProviders: 'Identity Providers',
	identity_provider: 'identity provider',
	identity_providers: 'identity providers',

	description: 'Corporate authentication provider for granting users access',
	descriptions: 'List of authentication providers for granting corporate user access',

	properties: {
		identityProviderId: {
			label: 'Id',
			description: 'The unique identifier of the provider',
		},
		type: {
			label: 'Type',
			description: 'The type of identity provider',
		},
		name: {
			label: 'Name',
			description: 'Unique name for this federated identity provider',
		},
		description: {
			label: 'Description',
			description: 'Short description of the provider',
			placeholder: 'Enter a description',
		},
		identifiers: {
			label: 'Identifier',
			description: 'Optional identifiers for this provider',
		},
		attributeMapping: {
			label: 'Attribute Mappings',
			description: 'Map user attributes from external identity providers to the corresponding attributes for Cognito User Pools',
		},
		enabled: {
			label: 'Enabled',
			description: 'Specify if the identity provider is enabled or not',
		},
	}
}

export default IdentityProvider;

export const IdentityProvider_ = {
	ATTRIBUTES: {
		preferredUsername: {
			label: 'Preferred Username',
			description: 'Human-readable claim attribute used to uniquely identity users',
			hintText: '(eg: email, username, sub)',
		} as StringEntityProperty,
	}
} as const;
