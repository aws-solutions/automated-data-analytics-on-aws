/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import baseConfig from './jest.config.base';
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  ...baseConfig(),
  projects: ['<rootDir>/src/**/jest.config.ts'],
  testSequencer: '<rootDir>/jest.sequencer.ts',
};

export default config;
