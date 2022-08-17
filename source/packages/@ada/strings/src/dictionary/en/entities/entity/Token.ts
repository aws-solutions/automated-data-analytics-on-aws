/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Token: StringEntityDefinition<'Token'> = {
	Token: 'API Key',
	Tokens: 'API Keys',
  // @ts-ignore - allow caps for API
	token: 'API key',
  // @ts-ignore - allow caps for API
	tokens: 'API keys',

	description: 'Access token used to programatically access the API',
	descriptions: 'List of access tokens used to programatically access the API',

	properties: {
		name: {
      label: 'Name',
      description: 'A friendly name to identify the API key',
    },
    enabled: {
      label: 'Enabled',
      description: 'Indicates if the API key is active',
    },
    expiration: {
      label: 'Expiration',
      description: 'The expiration date of the API key',
    },
    clientId: {
      label: 'Client Id',
      description: '',
    },
    clientSecret: {
      label: 'Client Secret',
      description: '',
    },
    authUrl: {
      label: 'Auth URL',
      description: '',
    },
    authToken: {
      label: 'API Key',
      description: '',
    },
	}
}

export default Token;
