/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { startAndSaveQuery } from '../../components/query-execution';

/**
 * Handler for starting a new step function that handles queries in Athena
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'postQuery',
  async ({ body: { query } }, callingUser) => {
    return ApiResponse.success({
      executionId: await startAndSaveQuery(query, callingUser),
    });
  },
  ApiLambdaHandler.doNotLockPrimaryEntity,
);
