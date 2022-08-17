/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { GroupStore } from '../../../api/components/ddb/groups';

/**
 * Handler for adding new members to a group
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityGroupMembers',
  async ({ requestParameters, body }, { userId, groups }) => {
    const { groupId } = requestParameters;
    const store = GroupStore.getInstance();
    const group = await store.getGroup(groupId);

    if (!group) {
      return ApiResponse.notFound({ message: `Not Found: no group was found with groupId ${groupId}` });
    }

    // Only the group owner or admin is allowed to edit the group if it exists
    if (group.createdBy !== userId && !groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `The group is owned by ${group.createdBy}. A group may only be updated by its owner, or a user in the ${DefaultGroupIds.ADMIN} group.`,
      });
    }

    return ApiResponse.success((await store.addMembers(groupId, userId, body.members))!);
  },
);
