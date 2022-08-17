/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['jest-extended'],
  roots: ['<rootDir>/src'],
  coveragePathIgnorePatterns: ['testing/*'],
};

export default config;
