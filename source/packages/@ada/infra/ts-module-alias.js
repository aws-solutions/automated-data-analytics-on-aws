/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable @typescript-eslint/no-var-requires */
const JSON5 = require('json5');
const fs = require('fs-extra');
const path = require('path');

const { compilerOptions } = JSON5.parse(fs.readFileSync(path.join(__dirname, './tsconfig.json'), 'utf-8'));

// Allow for individual project jest configs to be written in typescript
require('ts-node').register({
  compiler: 'ttypescript',
});

// Ensure that module aliases are resolved correctly by jest configs
require('module-alias').addAliases(
  Object.fromEntries(
    Object.keys(compilerOptions.paths || {}).map((alias) => [
      alias.replace('/*'),
      path.resolve(__dirname, compilerOptions.paths[alias][0].replace(/(index\.ts|\/*)$/i, '')),
    ]),
  ),
);

module.exports = {
  compilerOptions,
};
