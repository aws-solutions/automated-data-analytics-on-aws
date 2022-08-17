/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import baseConfig from '../jest.config.base';
import type { Config } from '@jest/types';

const { moduleNameMapper } = baseConfig;

export const config: Config.InitialOptions = {
  preset: 'jest-puppeteer',
  displayName: 'Puppeteer',
  moduleNameMapper,
};

export default config;
