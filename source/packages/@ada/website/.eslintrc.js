/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
const baseConfig = require('../../../.eslintrc.js')

module.exports = {
  ...baseConfig,
  root: true,
  extends: [
    ...baseConfig.extends,
    'react-app',
    'react-app/jest',
  ],
  rules: {
    ...baseConfig.rules,
    'no-restricted-imports': [
      1,
      {
        paths: ['@material-ui/core', 'aws-northstar'],
        patterns: ['@material-ui/*/*/*', 'aws-northstar/*/*/*', '!@material-ui/core/test-utils/*'],
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^(React|_.*)$', varsIgnorePattern: '^(React|_.*)$' }],
  },
};
