/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['jest-extended'],
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    // https://github.com/ivanhofer/typesafe-i18n#tests-are-not-running-with-jest
    "typesafe-i18n/react": "typesafe-i18n/react/index.cjs",
    "typesafe-i18n/formatters": "typesafe-i18n/formatters/index.cjs",
    "typesafe-i18n/detectors": "typesafe-i18n/detectors/index.cjs",
  }
};

export default config;
