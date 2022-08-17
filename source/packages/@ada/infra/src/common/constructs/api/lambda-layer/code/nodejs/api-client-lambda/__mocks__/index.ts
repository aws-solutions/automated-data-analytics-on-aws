/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Api from '@ada/api-client';
import fetch from 'isomorphic-fetch';
import type { ApiClientConfig, CallingUser, Environment } from '../';

jest.mock('@ada/api-client');
const { AdditionalHeaders } = jest.requireActual('../index.ts');

export const authMiddlewareFactory = (_callingUser: CallingUser): Api.Middleware => {
  return {
    pre: async (context: Api.RequestContext) => {
      const { url, init } = context;
      return {
        url,
        init: {
          ...init,
          headers: {
            ...init.headers,
            [AdditionalHeaders.ID_TOKEN]: '<internal call>',
            Authorization: 'internal',
          },
        },
      };
    },
  } as Api.Middleware;
};

export class ApiClient extends Api.DefaultApi {
  static create(callingUser: CallingUser, config?: Environment): Api.DefaultApi {
    return new ApiClient(callingUser, config || {});
  }

  private constructor(callingUser: CallingUser, _config: ApiClientConfig, parameters?: Api.ConfigurationParameters) {
    const options = { API_ENDPOINT: 'https://mock-api-endpoint.com' };
    const configuration = new Api.Configuration({
      basePath: options.API_ENDPOINT,
      fetchApi: fetch,
      middleware: [authMiddlewareFactory(callingUser)],
      ...parameters,
    });
    super(configuration);
  }
}

export { Api };
