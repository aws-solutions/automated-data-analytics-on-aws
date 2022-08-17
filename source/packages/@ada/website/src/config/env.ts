/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { queryFlags } from './utils';

export const ENV_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const ENV_TEST = process.env.NODE_ENV === 'test';
export const ENV_PRODUCTION = process.env.NODE_ENV === 'production';
export const ENV_STORYBOOK = process.env.STORYBOOK;

const FLAGS = queryFlags({
  DEBUG: ENV_DEVELOPMENT,
});

export const DEBUG = FLAGS.DEBUG;
