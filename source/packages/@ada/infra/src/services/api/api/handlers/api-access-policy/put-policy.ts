/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  ApiAccessPolicyStore,
  ApiAccessPolicyWithCreateUpdateDetails,
} from '../../../components/ddb/api-access-policy';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultUser } from '@ada/microservice-common';

/**
 * Handler for creating/updating an api access policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putApiAccessPolicy',
  async ({ requestParameters, body: policyToWrite }, { userId }) => {
    const { apiAccessPolicyId } = requestParameters;

    const ret = await ApiAccessPolicyStore.getInstance().putApiAccessPolicy(
      apiAccessPolicyId,
      userId,
      policyToWrite,
      userId === DefaultUser.SYSTEM,
    );

    if (userId !== DefaultUser.SYSTEM) {
      return ApiResponse.success(ret);
    } else {
      return ApiResponse.success({
        apiAccessPolicyId: ret.apiAccessPolicyId,
      } as ApiAccessPolicyWithCreateUpdateDetails);
    }
  },
);
