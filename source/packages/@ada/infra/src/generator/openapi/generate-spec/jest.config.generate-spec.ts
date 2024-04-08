/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createConfig from '../../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';

export const baseConfig = createConfig({
  displayName: "openapi-generate-spec",
  rootDir: path.resolve(__dirname, '../../../'),
  testTimeout: 30000,
  silent: false,
  // only run for our generator file
  testMatch: [require.resolve('./generate')],
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
});

const config = {
  ...baseConfig,
  setupFilesAfterEnv: [
    'jest-extended',
  ],
}

export default config;
