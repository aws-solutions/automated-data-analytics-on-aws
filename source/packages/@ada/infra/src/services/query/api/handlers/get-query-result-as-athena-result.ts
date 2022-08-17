/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { getQueryResultsAsAthena } from '../../components/athena';
import { validateExecutionDetails } from '../../components/lambda';

/**
 * Handler for retrieving the athena results, supports pagination
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'listQueryResultsAsAthenaResults',
  async ({ requestParameters }, callingUser) => {
    const { executionId, maxResults, nextToken } = requestParameters;
    const result = await validateExecutionDetails(executionId, callingUser);

    if ('statusCode' in result) {
      return result;
    }

    return ApiResponse.success(
      await getQueryResultsAsAthena(
        (result).output,
        maxResults === undefined ? undefined : Number(maxResults),
        nextToken,
      ),
    );
  },
);
