/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { isArray, isPlainObject, mergeWith } from "lodash";
import { jsWithTs } from 'ts-jest/presets';
import { pathsToModuleNameMapper } from 'ts-jest/utils';
import type { Config } from '@jest/types';

// https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping/
const { compilerOptions } = require('./ts-module-alias');

export interface BaseConfig extends Config.InitialOptions { }

export interface BaseConfigOptions {
  /**
   * Indicates if arrays are recursively merged (concat), or replaced.
   * @default true - merged
   */
  readonly mergeArrays?: boolean;
  /**
   * Indicates if plain objects are recursively merged, or replaced.
   * @default true - merged
   */
  readonly mergeObjects?: boolean;
}

export const createConfig = (config: Config.InitialOptions, options?: BaseConfigOptions): Config.InitialOptions => {
  let displayName = config.displayName || config.rootDir || createConfig.caller?.name;
  if (typeof displayName != 'string') displayName = displayName.name;
  if (path.isAbsolute(displayName)) displayName = path.basename(displayName);

  delete config.displayName; // drop it from source to override

  const _base = {
    ...jsWithTs,
    verbose: true,
    maxWorkers: '40%', // keeping this a bit low given multiple dynamodb clients
    setupFilesAfterEnv: [
      'jest-extended',
      path.resolve(__dirname, 'jest.setup.ts'),
    ],
    transformIgnorePatterns: ['.*\\.js$'],
    // https://jestjs.io/blog/2020/01/21/jest-25#v8-code-coverage
    // Requires `NODE_OPTIONS=--no-experimental-fetch`
    coverageProvider: "v8",
    coverageReporters: [["json", { file: `coverage-${displayName}.json` }]],
    coverageDirectory: path.join(__dirname, "coverage", "nested"),
    globals: {
      'ts-jest': {
        isolatedModules: true,
      },
    },
    moduleNameMapper: {
      ...pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: __dirname }),
      "^axios$": "axios/dist/node/axios.cjs"
    },
    displayName,
  }

  return mergeWith(_base, config, (objValue, srcValue) => {
    if (isArray(objValue)) {
      if (options?.mergeArrays === false) {
        return srcValue;
      } else {
        return objValue.concat(srcValue);
      }
    }
    if (options?.mergeObjects === false && isPlainObject(objValue)) {
      return srcValue;
    }
  })
};

export default createConfig;
