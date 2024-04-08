/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import createConfig from '../infra/jest.config.base'; // must be imported before any aliases

export const config = createConfig({
  displayName: path.basename(__dirname),
  roots: ['<rootDir>/src'],
});

export default config;
