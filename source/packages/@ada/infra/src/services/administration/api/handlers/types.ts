/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { RETAINED_RESOURCES_ENV_VAR } from '@ada/cdk-core';

export enum TearDownMode {
  RETAIN_DATA = 'retain-data',
  DESTROY_DATA = 'destroy-data',
}

export interface TearDownLambdaEvent {
  mode: TearDownMode;
}

export interface TeardownEnvironmentVars {
  DATA_PRODUCT_TABLE_NAME: string;
  CORE_STACK_ID: string;
  CORE_STACK_NAME: string;
  TEAR_DOWN_LAMBDA_ARN: string;
  // JSON stringified array of resource arns that are retained
  [RETAINED_RESOURCES_ENV_VAR]: string;
}
