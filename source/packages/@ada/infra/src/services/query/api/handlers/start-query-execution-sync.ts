/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { StatusCodes } from 'http-status-codes';
import { startAndSaveQuery } from '../../components/query-execution';

/**
 * Handler for starting a new step function that handles queries in Athena and returns a redirect to the sync API result
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getQuerySync',
  async ({ requestParameters: { query } }, callingUser, event) => {
    const executionId = await startAndSaveQuery(query, callingUser);

    return ApiResponse.respondWithHeaders(
      StatusCodes.SEE_OTHER,
      { message: 'Please follow redirect for query results' },
      {
        location: `/${event.requestContext.stage}/query/sync/${executionId}/result`,
      },
    );
  },
);
