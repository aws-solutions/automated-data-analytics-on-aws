/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_STORYBOOK } from '$config';

export enum DELAY {
  IMMEDIATE = ENV_STORYBOOK ? 10 : 1,
  TYPING = 10,
  SHORT = ENV_STORYBOOK ? 100 : 10,
  MEDIUM = ENV_STORYBOOK ? 500 : 100,
  LONG = ENV_STORYBOOK ? 1000 : 250,
  LONGEST = ENV_STORYBOOK ? 2000 : 1000,
}
