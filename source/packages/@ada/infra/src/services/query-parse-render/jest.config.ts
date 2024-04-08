/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable: sort-imports */
// must be imported before any aliases
import createConfig from '../../../jest.config.base';
/* eslint-enable: sort-imports */

export const config = createConfig({
  rootDir: __dirname,
});

export default config;
