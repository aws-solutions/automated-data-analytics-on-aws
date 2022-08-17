/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';
import { TokenStore } from '../../../api/components/ddb/token-provider';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Handler for deleting a machine by machineId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteIdentityMachine',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, lockClient }) => {
    const { machineId } = requestParameters;
    const machine = await MachineStore.getInstance().getMachine(machineId);

    if (!machine) {
      return ApiResponse.notFound({ message: `Not Found: no machine was found with machineId ${machineId}` });
    }

    // Only admin or the machine creator may delete the machine
    if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && machine.createdBy !== callingUser.userId) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to delete the machine with id ${machineId}`,
      });
    }

    const tokenStore = TokenStore.getInstance();
    const { tokens } = await tokenStore.listTokens(machineId, {});

    // Lock the tokens as we'll delete them too
    const tokenEntities = tokens.map((token) => entityIdentifier('IdentityMachineToken', token));
    const tokenLocks = await lockClient.acquire(...tokenEntities);

    await tokenStore.deleteMachineAndTokens(
      machineId,
      tokens.map((q) => q.tokenId),
    );

    await relationshipClient.removeAllRelationships(entityIdentifier('IdentityMachine', { machineId }));

    await lockClient.release(...tokenLocks);

    return ApiResponse.success(machine);
  },
);
