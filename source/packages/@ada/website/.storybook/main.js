/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  webpackFinal: async (config) => {
    // resolve typescript aliases
    config.resolve.plugins.push(new TsconfigPathsPlugin());

    config.resolve.alias = {
      ...config.resolve.alias,
      '@ada/api-client$': '@ada/api-client/__mocks__/index',
    };

    return config;
  },
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/preset-create-react-app',
    '@storybook/addon-interactions',
    '@storybook/addon-jest',
  ],
  framework: '@storybook/react',
  features: {
    interactionsDebugger: true,
  },
};
