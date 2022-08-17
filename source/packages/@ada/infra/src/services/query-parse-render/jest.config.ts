/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import baseConfig from '../../../jest.config.base';
/* eslint-enable: sort-imports */
import * as path from 'path';
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  ...baseConfig(),
  rootDir: __dirname,
  displayName: path.basename(__dirname),
};

export default config;
