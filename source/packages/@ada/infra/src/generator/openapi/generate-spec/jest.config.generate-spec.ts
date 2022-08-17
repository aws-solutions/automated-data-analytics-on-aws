/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createBaseConfig from '../../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';
import type { Config } from '@jest/types';

/* eslint-disable */
const baseConfig = createBaseConfig({
  disableCustomSetupScript: true,
});

export const config: Config.InitialOptions = {
  ...baseConfig,
  rootDir: path.resolve(__dirname, '../../../'),
  displayName: path.basename(__dirname),
  testTimeout: 30000,
  silent: false,
  // only run for our generator file
  testMatch: [require.resolve('./generate')],
  globals: {
    ...(baseConfig.globals || {}),
    'ts-jest': {
      ...(((baseConfig.globals || {})['ts-jest'] as object) || {}),
      // https://huafu.github.io/ts-jest/user/config/isolatedModules
      // Prevent type-checking for generating api client since infra package references api code.
      // Types are somewhat checked when client is actually compiled so this is moderately safe to assume types are checked
      // within context of generating the api schema / client
      isolatedModules: true,
    },
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!**/*.test.*',
    '!**/*jest*',
    '!**/testing/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/handler/**',
    '!**/handlers/**',
  ]
};

export default config;
