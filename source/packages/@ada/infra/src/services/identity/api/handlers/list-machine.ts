/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';

/**
 * Handler for listing machines
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listIdentityMachines', async ({ requestParameters }, callingUser) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Only admins may list all machines
  if (!callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
    return ApiResponse.forbidden({ message: `You don't have access to list all the machine` });
  }

  const response = await MachineStore.getInstance().listMachine(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
