/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler } from '@ada/api-gateway';
import { TearDownMode } from './types';
import { startTearDown } from './tear-down';

/**
 * Handler for starting the tear down process, destroying all data managed by the system
 */
export const handler = ApiLambdaHandler.for('deleteAdministrationStartTearDownDestroyData', () =>
  // Tear down permissions are governed by api access policies only, and by default this permission is only granted to admin
  startTearDown({ mode: TearDownMode.DESTROY_DATA }),
);
