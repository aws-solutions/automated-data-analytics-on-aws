/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { QueryHistoryStore } from '../../components/ddb/query-history';

/**
 * Handler for listing query execution
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listQueryHistories', async ({ requestParameters }, { userId }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Only the history for the calling user is returned
  const response = await QueryHistoryStore.getInstance().getUserQueryHistory(userId, paginationParameters);

  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
