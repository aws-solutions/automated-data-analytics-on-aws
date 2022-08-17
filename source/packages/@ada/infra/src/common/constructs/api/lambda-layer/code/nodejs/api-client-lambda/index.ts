/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Api from '@ada/api-client';
import { SecretsManager } from 'aws-sdk';
import { TokenType, signJwt } from './jwt-signer';
import { VError } from 'verror';
import fetch from 'isomorphic-fetch';

const TEST_WAF_ALLOW_VALUE = 'test-secret-value';

// re-defining this to avoid bundling issues (as the @ada/common pagacke uses a relative import that fail at runtime)
export interface CallingUser {
  readonly userId: string;
  readonly username: string;
  readonly groups: string[];
}

export const API_WAF_ALLOW_RULE_SECRET_ENV = 'API_WAF_ALLOW_RULE_SECRET';

export enum AdditionalHeaders {
  ID_TOKEN = 'x-id-token',
  // Incases where WAF IPSet filter is added, we need to allow internal calls to pass IP address filter.
  // If we detected header with correct global hash we ignore IP filter
  WAF_ALLOW_RULE = 'x-api-waf-allow',
}

export enum AuthorizationType {
  BEARER = 'bearer',
  API_KEY = 'api-key',
  INTERNAL_TOKEN = 'internal-token',
}

/*
 This module is used to instantiate the api client for a lambda
 function using the shared api-client package from the layer.
*/

export interface Environment {
  readonly API_ENDPOINT: string;
  readonly API_WAF_ALLOW_RULE_SECRET: string;
}

export type ApiClientConfig = Partial<Environment>;

const { API_ENDPOINT, API_WAF_ALLOW_RULE_SECRET } = process.env as unknown as Environment;

// in seconds, default 15 minutes (equal to max lambda runtime duration)
export const INTERNAL_TOKEN_DURATION = 900;

function interpolateConfig(config: ApiClientConfig): Required<ApiClientConfig> {
  const endpoint = config.API_ENDPOINT || API_ENDPOINT;
  if (endpoint == null && process.env.NODE_ENV !== 'test') {
    throw new Error('Api endpointXXX not defined - either pass in config or set as `process.env.API_ENDPOINT`');
  }

  return {
    API_ENDPOINT: endpoint,
    API_WAF_ALLOW_RULE_SECRET,
  };
}

const secretsManager = new SecretsManager();
let wafAllowHeaderValue: string | undefined;
async function getWafAllowHeaderValue(): Promise<string> {
  if (wafAllowHeaderValue) return wafAllowHeaderValue;

  try {
    const { SecretString } = await secretsManager
      .getSecretValue({
        SecretId: API_WAF_ALLOW_RULE_SECRET,
      })
      .promise();

    // waf rule expects base64 encoded
    //store locally to reuse between calls
    wafAllowHeaderValue = Buffer.from(SecretString as string).toString('base64');

    return wafAllowHeaderValue;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'test') {
      return TEST_WAF_ALLOW_VALUE;
    }

    throw new VError(error, 'Failed to get internal call secret: ' + API_WAF_ALLOW_RULE_SECRET);
  }
}

/**
 * generate the jwt token to be used for internal call, the token will be validated by the custom authorizer
 * @param CallingUser the user that is performing the call
 * @returns a signed jwt token to be used for the API calls
 */
export const generateJwtInternalToken = (callingUser: CallingUser): Promise<string> => {
  return signJwt<CallingUser>(callingUser, new Date(Date.now() + 1000 * INTERNAL_TOKEN_DURATION), TokenType.INTERNAL);
};

export const authMiddlewareFactory = (getHeaders: () => Promise<{ [key: string]: string }>): Api.Middleware => {
  return {
    pre: async (context: Api.RequestContext) => {
      const { url, init } = context;
      return {
        url,
        init: {
          ...init,
          headers: {
            ...init.headers,
            ...(await getHeaders()),
            // Add solution unique secret to each internal call to bypass IP filtering WAF fules
            // This secret does not provide authorization access of any kind, it simply triggers allow
            // rule in WAF before the IPSet block rule is applied to prevent internal calls from
            // get blocked by WAF.
            [AdditionalHeaders.WAF_ALLOW_RULE]: await getWafAllowHeaderValue(),
          },
        },
      };
    },
  } as Api.Middleware;
};

export const callingUserMiddlewareFactory = (callingUser: CallingUser): Api.Middleware => {
  return authMiddlewareFactory(async () => ({
    Authorization: `${AuthorizationType.INTERNAL_TOKEN} ${await generateJwtInternalToken(callingUser)}`,
  }));
};

export const accessTokenMiddlewareFactory = (accessToken: string): Api.Middleware => {
  return authMiddlewareFactory(async () => ({
    Authorization: `${AuthorizationType.BEARER} ${accessToken}`,
  }));
};

export class ApiClient extends Api.DefaultApi {
  static create(callingUser: CallingUser, config?: Environment): Api.DefaultApi {
    return new ApiClient([callingUserMiddlewareFactory(callingUser)], config || {});
  }

  static createWithAccessToken(apiKey: string, config?: Environment): Api.DefaultApi {
    return new ApiClient([accessTokenMiddlewareFactory(apiKey)], config || {});
  }

  private constructor(
    middleware: Api.Middleware[],
    _config: ApiClientConfig,
    parameters?: Api.ConfigurationParameters,
  ) {
    const options = interpolateConfig(_config);
    const configuration = new Api.Configuration({
      basePath: options.API_ENDPOINT,
      fetchApi: fetch,
      middleware,
      ...parameters,
    });
    super(configuration);
  }
}

export { Api };
