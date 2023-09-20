/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_STORYBOOK, ENV_TEST } from '$config/env';
export interface RuntimeConfig {
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly apiUrl: string;
  readonly region: string;
  readonly accountId: string;
  readonly oauthScopes: string[];
  readonly oauthDomain: string;
  readonly ouathResponseType: string;
  readonly athenaProxyApiUrl: string;
}

const RUNTIME_CONFIG_KEY = 'runtime-config';

declare global {
  interface Window {
    [RUNTIME_CONFIG_KEY]: RuntimeConfig;
  }
}

if (ENV_TEST || ENV_STORYBOOK) {
  // Mock the runtime config
  window[RUNTIME_CONFIG_KEY] = {
    userPoolId: 'ap-southeast-1_ABCDEFGHI',
    userPoolClientId: 'mockUserPoolClientId',
    apiUrl: 'https://test.api/',
    region: 'ap-southeast-1',
    accountId: '123456789012',
    oauthScopes: ['phone', 'profile', 'openid', 'email', 'aws.cognito.signin.user.admin'],
    oauthDomain: 'test.auth.ap-southeast-1.amazoncognito.com',
    ouathResponseType: 'code',
    athenaProxyApiUrl: 'athena-proxy-test.api:443',
  };
}

export const RuntimeConfig = window[RUNTIME_CONFIG_KEY]; //NOSONAR (S2814:Duplicate) - false positive - type vs value
