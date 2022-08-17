/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Api from '@ada/api-client';
import { AdditionalHeaders } from '@ada/common';
import { Auth } from 'aws-amplify';
import { RuntimeConfig } from '../../runtime-config';

export interface ApiClientConfig {
  endpoint: string;
  region: string;
}

export async function getAuthHeaders() {
  const accessToken = (await Auth.currentSession()).getAccessToken().getJwtToken();
  const idToken = (await Auth.currentSession()).getIdToken().getJwtToken();

  return {
    Authorization: `Bearer ${accessToken}`,
    [AdditionalHeaders.ID_TOKEN]: idToken,
  };
}

export class ApiClient extends Api.DefaultApi {
  static create(config?: Partial<ApiClientConfig>): Api.DefaultApi {
    return new ApiClient({
      endpoint: RuntimeConfig.apiUrl,
      region: RuntimeConfig.region,
      ...(config || {}),
    });
  }

  private constructor(config: ApiClientConfig) {
    const { endpoint } = config;
    const configuration = new Api.Configuration({
      basePath: endpoint.endsWith('/') ? endpoint.substring(0, endpoint.length - 1) : endpoint,
      fetchApi: fetch,
      middleware: [
        {
          pre: async (context: Api.RequestContext) => {
            context.init.headers = {
              ...(context.init.headers || {}),
              ...(await getAuthHeaders()),
            };
          },
        } as Api.Middleware,
      ],
    });
    super(configuration);
  }
}

// create default api client
export const api = ApiClient.create();
