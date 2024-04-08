/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createConfig from '../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';
import { generateEnvironmentForTests } from './jest-dynamodb-config';
import { writeCdkEnvironmentToFile } from '../../common/services/testing/environment';

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

export const config = createConfig({
  ...require('@shelf/jest-dynamodb/jest-preset'),
  rootDir: __dirname,
  globals: {
    __JEST_DYNAMODB_TABLES: tables,
  },
  setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.ts')],
  testTimeout: 30000,
});

export default config;
