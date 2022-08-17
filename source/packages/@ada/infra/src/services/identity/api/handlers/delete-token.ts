/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { TokenStore } from '../../../api/components/ddb/token-provider';
import { deleteUserPoolClient } from '../../../api/components/cognito/cognito-identity-service-provider';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Handler for deleting a token by machineId and tokenId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteIdentityMachineToken',
  async ({ requestParameters }, callingUser, _event, { relationshipClient }) => {
    const { machineId, tokenId } = requestParameters;

    const token = await TokenStore.getInstance().deleteTokenIfExists(machineId, tokenId);

    if (!token) {
      return ApiResponse.notFound({
        message: `Not Found: no token was found for machine ${machineId} with id ${tokenId}`,
      });
    }

    // Only an admin or the token creator may delete a token
    if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && token.createdBy !== callingUser.userId) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to delete the token for machine ${machineId} with id ${tokenId}`,
      });
    }

    await deleteUserPoolClient(token.clientId);
    await relationshipClient.removeAllRelationships(entityIdentifier('IdentityMachineToken', { machineId, tokenId }));

    return ApiResponse.success(token);
  },
);
