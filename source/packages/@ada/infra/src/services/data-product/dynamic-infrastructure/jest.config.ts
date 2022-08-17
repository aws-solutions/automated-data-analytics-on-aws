/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createBaseConfig from '../../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';
import { TEST_ENVIRONMENT } from '@ada/cdk-core';
import { generateEnvironmentForTests } from '../jest-dynamodb-config';
import type { Config } from '@jest/types';

const cdkEnvironment = generateEnvironmentForTests();
const { tables, port } = cdkEnvironment;

process.env = {
  ...process.env,
  JEST_DYNAMODB_CONFIG: path.resolve(__dirname, '../.jest.test-cdk-environment.json'),
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
  XRAY_DISABLED: true,
  // ensure concrete env for event rules
  // https://github.com/aws/aws-cdk/blob/5bad3aaac6cc7cc7befb8bdd320181a7c650f15d/packages/%40aws-cdk/aws-events/lib/rule.ts#L202
  CDK_DEPLOY_ACCOUNT: TEST_ENVIRONMENT.account,
  CDK_DEPLOY_REGION: TEST_ENVIRONMENT.region,
};

const baseConfig = createBaseConfig();

export const config: Config.InitialOptions = {
  ...baseConfig,
  ...require('@shelf/jest-dynamodb/jest-preset'),
  globals: {
    ...(baseConfig.globals || {}),
    __JEST_DYNAMODB_TABLES: tables,
  },
  setupFilesAfterEnv: [...(baseConfig.setupFilesAfterEnv || []), path.resolve(__dirname, '../jest.setup.ts')],
  rootDir: __dirname,
  displayName: path.basename(__dirname),
};

export default config;
