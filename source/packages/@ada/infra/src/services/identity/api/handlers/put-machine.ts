/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';

/**
 * Handler for creating/updating a machine
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityMachine',
  async ({ requestParameters, body: machine }, { userId, groups }) => {
    const { machineId } = requestParameters;

    const machineStore = MachineStore.getInstance();
    const existingMachine = await machineStore.getMachine(machineId);

    // Only the creator or admin may edit an existing machine
    if (existingMachine && existingMachine.createdBy !== userId && !groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `Only the owner (${existingMachine.createdBy}) or a member of the ${DefaultGroupIds.ADMIN} group may edit machine ${machineId}.`,
      });
    }

    // Any user can create a new machine so long as their api access policy allows
    return ApiResponse.success(
      await machineStore.putMachine(machineId, userId, {
        ...machine,
        machineId,
      }),
    );
  },
);
