/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';
import { TokenStore } from '../../../api/components/ddb/token-provider';

/**
 * Handler for listing tokens by machine id
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listIdentityMachineTokens', async ({ requestParameters }, callingUser) => {
  const { machineId } = requestParameters;
  const paginationParameters = getPaginationParameters(requestParameters);
  const machine = await MachineStore.getInstance().getMachine(machineId);

  if (!machine) {
    return ApiResponse.notFound({
      message: `No machine found with id ${machineId}`,
    });
  }

  // Only admins or the creator of the machine may list tokens for a machine
  if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && machine.createdBy !== callingUser.userId) {
    return ApiResponse.forbidden({
      message: `You don't access to the token inside the machine ${machineId}`,
    });
  }

  const response = await TokenStore.getInstance().listTokens(machineId, paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
