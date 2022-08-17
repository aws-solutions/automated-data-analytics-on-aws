/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createBaseConfig from '../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';
import { generateEnvironmentForTests } from './jest-dynamodb-config';
import { writeCdkEnvironmentToFile } from '../../common/services/testing/environment';
import type { Config } from '@jest/types';

const cdkEnvironment = generateEnvironmentForTests();
const JEST_DYNAMODB_CONFIG = path.resolve(__dirname, '.jest.test-cdk-environment.json');
writeCdkEnvironmentToFile(cdkEnvironment, JEST_DYNAMODB_CONFIG);
const { tables, port } = cdkEnvironment;

process.env = {
  ...process.env,
  JEST_DYNAMODB_CONFIG,
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
  XRAY_DISABLED: true,
};

const baseConfig = createBaseConfig();

export const config: Config.InitialOptions = {
  ...baseConfig,
  ...require('@shelf/jest-dynamodb/jest-preset'),
  globals: {
    ...(baseConfig.globals || {}),
    __JEST_DYNAMODB_TABLES: tables,
  },
  setupFilesAfterEnv: [...(baseConfig.setupFilesAfterEnv || []), path.resolve(__dirname, 'jest.setup.ts')],
  rootDir: __dirname,
  displayName: path.basename(__dirname),
  testTimeout: 10000,
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dynamic-infrastructure/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/docker-images/google-*'],
};

export default config;
