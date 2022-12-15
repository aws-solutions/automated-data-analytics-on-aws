/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import baseConfig from '../../jest.config.base';
import type { Config } from '@jest/types';

export const config: Config.InitialOptions = {
  ...baseConfig(),
  rootDir: __dirname,
  displayName: 'connectors',
};

export default config;
