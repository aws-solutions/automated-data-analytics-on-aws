/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';

/**
 * Handler for getting an api access policy by apiAccessPolicyId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getApiAccessPolicy', async ({ requestParameters }) => {
  const { apiAccessPolicyId } = requestParameters;

  const policy = await ApiAccessPolicyStore.getInstance().getApiAccessPolicy(apiAccessPolicyId);
  if (!policy) {
    return ApiResponse.notFound({ message: `Not Found: no api access policy was found with id ${apiAccessPolicyId}` });
  }
  return ApiResponse.success(policy);
});
