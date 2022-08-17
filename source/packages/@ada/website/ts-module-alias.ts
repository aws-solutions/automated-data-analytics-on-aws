/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
const JSON5 = require('json5');
const fs = require('fs-extra');
const path = require('path');

const { compilerOptions } = JSON5.parse(fs.readFileSync(path.join(__dirname, './tsconfig.aliases.json'), 'utf-8'));

// Ensure that module aliases are resolved correctly by jest configs
require('module-alias').addAliases(
  Object.fromEntries(
    Object.keys(compilerOptions.paths || {}).map((alias) => [
      alias,
      path.resolve(__dirname, compilerOptions.baseUrl, compilerOptions.paths[alias][0]),
    ]),
  ),
);

export { compilerOptions };
