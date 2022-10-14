/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { jsWithTs } from 'ts-jest/presets';
import type { Config } from '@jest/types';
// https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping/
import { compilerOptions } from './ts-module-alias';
import { pathsToModuleNameMapper } from 'ts-jest/utils';

export const config: Config.InitialOptions = {
  ...jsWithTs,
  globals: {
    'ts-jest': {
      'tsconfig': path.join(__dirname, 'tsconfig.test.json'),
    }
  },
  verbose: true,
  setupFiles: [
    // https://github.com/ionic-team/stencil/issues/2277
    'construct-style-sheets-polyfill',
    // https://github.com/hustcc/jest-canvas-mock
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: ['jest-extended'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: path.join(__dirname, compilerOptions.baseUrl),
    }),
    "@ada/strings/markdown/(.*)": '<rootDir>/__mocks__/@ada/strings/markdown-file.ts',
    // https://github.com/ivanhofer/typesafe-i18n#tests-are-not-running-with-jest
    "typesafe-i18n/react": "typesafe-i18n/react/index.cjs",
    "typesafe-i18n/formatters": "typesafe-i18n/formatters/index.cjs",
    "typesafe-i18n/detectors": "typesafe-i18n/detectors/index.cjs",
    'd3-color': '<rootDir>/../../../node_modules/d3-color/dist/d3-color.min.js',
  },
  transformIgnorePatterns: ['.*\\.js$'],
  testPathIgnorePatterns: ['/node_modules/', '.*\\puppeteer\\.*'],
  testRegex: '((\\.|/)(test|spec))\\.[jt]sx?$',
};

export default config;
