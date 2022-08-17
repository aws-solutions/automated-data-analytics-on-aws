/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
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

    // NB: Only the api access policy protects this api, and only admin has rights to call this api by default.
    return ApiResponse.success(
      // Allow the system user to overwrite an existing api access policy
      await ApiAccessPolicyStore.getInstance().putApiAccessPolicy(
        apiAccessPolicyId,
        userId,
        policyToWrite,
        userId === DefaultUser.SYSTEM,
      ),
    );
  },
);
