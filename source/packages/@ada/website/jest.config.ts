/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import baseConfig from './jest.config.base'; // must be imported before any aliases
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  ...baseConfig,
  setupFilesAfterEnv: [...(baseConfig.setupFilesAfterEnv || []), '<rootDir>/setupTests.ts'],
  moduleNameMapper: {
    ...(baseConfig.moduleNameMapper || {}),
    '\\.(css|less|scss|sss|styl)$': '<rootDir>/../../../node_modules/jest-css-modules',
    '\\.svg': '<rootDir>/__mocks__/svg.ts',
  },
  displayName: path.basename(__dirname),
  testRegex: '((\\.|/)(test|spec))\\.[jt]sx?$',
};

export default config;
