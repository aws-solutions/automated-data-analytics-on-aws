/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { getQueryResults } from '../../components/athena';
import { validateExecutionDetails } from '../../components/lambda';

/**
 * Handler for retrieving the athena results, supports pagination
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listQueryResults', async ({ requestParameters }, callingUser) => {
  const { executionId, retrieveDataIntegrity } = requestParameters;
  const result = await validateExecutionDetails(executionId, callingUser);

  if ('statusCode' in result) {
    return result;
  }

  const paginationParameters = getPaginationParameters(requestParameters);

  return ApiResponse.success(
    await getQueryResults(
      (result).output,
      paginationParameters,
      !!retrieveDataIntegrity,
    ),
  );
});
