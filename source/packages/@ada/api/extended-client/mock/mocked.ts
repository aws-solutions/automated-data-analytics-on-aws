/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { MockApiClient } from './types';

let proxy: MockApiClient;

if (process.env.STORYBOOK) {
  proxy = require('./mocked.browser').proxy;
} else {
  proxy = require('./mocked.node').proxy;
}

export const MOCK_API_CLIENT = proxy;

export class DefaultApi {
  constructor(..._args: any[]) {
    return proxy;
  }
}

export class Configuration {}
