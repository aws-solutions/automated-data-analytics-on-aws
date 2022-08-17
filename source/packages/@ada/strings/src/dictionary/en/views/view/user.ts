/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';

export const USER = {
	title: ENTITY.Users,
	nav: ENTITY.Users,
	subtitle: ENTITY.Users_description,

	HELP: {
		ROOT: {
			header: ENTITY.Users,
		},
		DETAIL: {
			header: ENTITY.User,
		},
	},

	ApiKey: {
		wizard: {
			title: `Create ${ENTITY.Token}`,
			description: 'Enable access based on your permissions without having to sign in',
			notify: {
				loginExpirationWarning:
					`${ENTITY.Token} will be automatically disabled if you do not login for more than 90 days.`,
				onetime: `Safely store your ${ENTITY.token}, this is the only time it will be available.`,
			},
		},

		STATUS: {
			enabled: 'Enabled',
			disabled: 'Disabled',
		},

		ACTIONS: {
			enable: {
				text: 'Enable',
				label: `Enable ${ENTITY.token} {0:string|entityName}`,
				notify: {
					success: `Enabled ${ENTITY.token} {0:string|entityName}`,
					failure: `Faided to enable ${ENTITY.token} {0:string|entityName}`,
				},
			},
			disable: {
				text: 'Disable',
				label: `Disable ${ENTITY.token} {0:string|entityName}`,
				notify: {
					success: `Disabled ${ENTITY.token} {0:string|entityName}`,
					failure: `Faided to disable ${ENTITY.token} {0:string|entityName}`,
				},
			},
		},
		SUMMARY: {
			SECTION: {
				clientCredentials: {
					title: 'Client credentials',
				},
				authEndpoint: {
					title: 'Auth endpoint',
				},
				integrationEntpoints: {
					title: 'Integration Endpoints',
					apiUrl: 'API URL',
					athenaProxyApiUrl: 'Athena Proxy URL',
				}
			},
			ACTIONS: {
				show: {
					text: 'Show',
				},
				hide: {
					text: 'Hide',
				},
			}
		}
	},

	API_ACCESS: {
		title: 'API Access',
		COLUMN: {
			route: {
				header: 'Route',
			},
			access: {
				header: 'Access',
			},
		},
	}
} as const;
