/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';
import { StringEntityProperty } from '../../entities/types';

export const IDENTITY_PROVIDER = {
	title: ENTITY.IdentityProviders,
	nav: ENTITY.IdentityProviders,
	subtitle: 'Allow users to sign in through external federated identity providers',

	HELP: {
		ROOT: {
			header: ENTITY.IdentityProviders,
		},
		DETAIL: {
			header: ENTITY.IdentityProvider,
		},
		CREATE: {
			header: `Create ${ENTITY.IdentityProvider}`,
		},
		UPDATE: {
			header: `Update ${ENTITY.IdentityProvider}`,
		},
	},

	PROVIDERS: {
		COMMON: {
			FIELDS: {
				clientId: {
					label: 'Client ID',
					description: 'Enter the client ID of your identity provider',
				},
				clientSecret: {
					label: 'Client Secret',
					description: 'Enter the client secret of your identity provider',
				},
				scopes: {
					label: 'Scopes',
					description: 'Enter the scopes of your identity provider. Seperate using spaces.',
				},
				_urlOrFileSelect: {
					label: 'File or Link?',
					description: 'Select how you want to upload your metadata',
					OPTIONS: {
						File: 'File Upload',
						Link: 'Link to metadata URL',
					}
				},
				metadataURL: {
					label: 'Metadata URL',
					description: 'Enter the metadata URL of your SAML identity provider',
				},
				metadataFile: {
					label: 'SAML Metadata file',
					description: 'The metadata file of your SAML identity provider',
				},
			},
		},
		AMAZON: {
			title: 'Login with Amazon',
			learnMore: {
				text: 'Learn more about Login with Amazon.',
				link: 'https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html',
			},
		},
		GOOGLE: {
			title: 'Google',
			learnMore: {
				text: 'Learn more about Google sign in.',
				link: 'https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html',
			},
		},
		OIDC: {
			title: 'OIDC',
			learnMore: {
				text: 'Learn more about OpenID Connect.',
				link: 'https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-provider.html#cognito-user-pools-oidc-providers',
			},
			FIELDS: {
				issuer: {
					label: 'Issuer',
					description: 'Enter the issuer of your identity provider',
				},
				attributeRequestMethod: {
					label: 'Attribute Request Method',
					description: 'Choose the HTTP method for requesting attributes',
				},
				advanced: {
					label: 'Advanced (optional)',
					description: 'If you would like to further configure advanced options fill in these fields',
				},
				authorizeUrl: {
					label: 'Authorize URL',
					description: 'Enter the Authorize URL of your identity provider',
				},
				tokenUrl: {
					label: 'Token URL',
					description: 'Enter the Token URL of your identity provider',
				},
				attributesUrl: {
					label: 'Attributes URL',
					description: 'Enter the Attributes URL of your identity provider',
				},
				jwksUri: {
					label: 'Jwks URI',
					description: 'Enter the Jwks URI of your identity provider',
				},
			}
		},
		SAML: {
			title: 'SAML',
			learnMore: {
				text: 'Learn more about SAML.',
				link: 'https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html',
			},
			FIELDS: {
				signOut: {
					label: 'Enable IdP sign out flow',
				},
			},
		},
	},

	SETTINGS: {
		OAUTH: {
			title: 'OAuth Settings',
			domain: 'Domain',
			callbackUrl: 'Callback URL',
		},
		SAML: {
			title: 'SAML Settings',
			acsUrl: 'ACS URL (ACS URL Validator)',
			callbackUrl: 'Callback URL',
			audienceUri: 'Audience URI (SP Entity ID)',
		},
	},

	WIZARD: {
		FIELDS: {
			type: {
				label: 'Provide Type',
				description: 'Select and configure the external identity providers you want to enable',
				learnMore: 'Learn more',
			},
			attributeMapping: {
				label: 'Profile Attribute (optional)',
				description: 'Additional attributes to provide user profile details',
				hintText: 'You can add up to 25 more items',
				emptyText: 'Add profile attriubtes',
				FIELDS: {
					providerAttribute: {
						label: 'External Provider Attribute',
					},
					cognitoAttribute: {
						label: 'User Pool Attribute',
						placeholder: 'Choose the User Pool Attribute',
					},
				},
			} as StringEntityProperty,
		}
	},


	STATUS: {
		label: 'Status',
		enabled: 'Enabled',
		disabled: 'Disabled',
	},

	SUMMARY: {
		DETAILS: {
			title: '{0:string} Details',
		},
	},
} as const;
