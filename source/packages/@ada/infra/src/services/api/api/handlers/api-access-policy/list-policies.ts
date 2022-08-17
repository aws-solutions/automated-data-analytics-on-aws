/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';

/**
 * Handler for listing api access policies
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listApiAccessPolicies', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Any user may list api access policies, so long as their api access policy allows
  const response = await ApiAccessPolicyStore.getInstance().listApiAccessPolicies(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
});
