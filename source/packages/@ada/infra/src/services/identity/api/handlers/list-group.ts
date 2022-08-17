/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { GroupStore } from '../../../api/components/ddb/groups';

/**
 * Handler for listing groups
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listIdentityGroups', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Any user may list groups so long as their api access policy allows
  const response = await GroupStore.getInstance().listGroups(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
});
