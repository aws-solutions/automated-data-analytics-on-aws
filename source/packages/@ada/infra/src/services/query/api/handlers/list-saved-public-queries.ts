/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { PublicSavedQueryStore } from '../../components/ddb/saved-query';

/**
 * Handler for listing all public saved queries
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listQuerySavedQueries', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Public queries are listable by all users
  const response = await PublicSavedQueryStore.getInstance().listAllSavedQueries(paginationParameters);

  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
