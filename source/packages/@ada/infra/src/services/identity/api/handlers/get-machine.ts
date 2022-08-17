/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';

/**
 * Handler for getting a machine by machineId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getIdentityMachine', async ({ requestParameters }, callingUser) => {
  const { machineId } = requestParameters;

  const machine = await MachineStore.getInstance().getMachine(machineId);
  if (!machine) {
    return ApiResponse.notFound({ message: `Not Found: no machine was found with machineId ${machineId}` });
  }

  if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && machine.createdBy !== callingUser.userId) {
    return ApiResponse.forbidden({
      message: `You don't have access to the requested machine ${machineId}`,
    });
  }

  return ApiResponse.success(machine);
});
