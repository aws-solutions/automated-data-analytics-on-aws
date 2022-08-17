/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { TokenStore } from '../../../api/components/ddb/token-provider';

/**
 * Handler for getting a token by machineId and tokenId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getIdentityMachineToken', async ({ requestParameters }, callingUser) => {
  const { machineId, tokenId } = requestParameters;

  const token = await TokenStore.getInstance().getToken(machineId, tokenId);
  if (!token) {
    return ApiResponse.notFound({
      message: `Not Found: no token was found for machine ${machineId} with id ${tokenId}`,
    });
  }

  if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && token.createdBy !== callingUser.userId) {
    return ApiResponse.forbidden({
      message: `You don't have access to the requested token ${tokenId} for machine ${machineId}`,
    });
  }

  return ApiResponse.success({
    ...token,
    secret: undefined,
  });
});
