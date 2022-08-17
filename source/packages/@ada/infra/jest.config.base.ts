/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { jsWithTs } from 'ts-jest/presets';
import type { Config } from '@jest/types';
// https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping/
import * as path from 'path';
import { pathsToModuleNameMapper } from 'ts-jest/utils';

const { compilerOptions } = require('./ts-module-alias');

export interface BaseConfigProps {
  disableCustomSetupScript?: boolean;
}

export const config = (props?: BaseConfigProps): Config.InitialOptions => ({
  ...jsWithTs,
  verbose: true,
  maxWorkers: '40%', // keeping this a bit low given multiple dynamodb clients
  setupFilesAfterEnv: [
    'jest-extended',
    ...(props?.disableCustomSetupScript ? [] : [path.resolve(__dirname, 'jest.setup.ts')]),
  ],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: __dirname }),
  transformIgnorePatterns: ['.*\\.js$'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
});

export default config;
