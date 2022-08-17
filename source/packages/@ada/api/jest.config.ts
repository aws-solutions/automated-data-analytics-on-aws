/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { jsWithTs } from 'ts-jest/presets';
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  ...jsWithTs,
  verbose: true,
  transformIgnorePatterns: ['.*\\.js$'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  displayName: path.basename(__dirname),
  rootDir: 'extended-client/types',
  moduleNameMapper: {
    "^../(.*)": [
      "../$1",
      path.join(__dirname, 'client/$1'),
    ]
  },
  coverageDirectory: path.join(__dirname, 'coverage'),
};

export default config;
