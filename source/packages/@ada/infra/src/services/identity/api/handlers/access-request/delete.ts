/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestStore } from '../../../../api/components/ddb/access-request';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { GroupStore } from '../../../../api/components/ddb/groups';

/**
 * Handler for deleting a access request by ids
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('deleteIdentityRequest', async ({ requestParameters }, callingUser) => {
  const { groupId, userId } = requestParameters;
  const accessRequestStore = AccessRequestStore.getInstance();
  const groupStore = GroupStore.getInstance();

  const [group, accessRequest] = await Promise.all([
    groupStore.getGroup(groupId),
    accessRequestStore.getAccessRequest(groupId, userId),
  ]);

  if (!accessRequest) {
    return ApiResponse.notFound({
      message: `Not Found: no access request was found with groupId ${groupId} for userId ${userId}`,
    });
  }

  // The user deleting the access request can be the creator of the request, the subject of the request, or the owner of the group the request pertains to
  // Admins may also delete any access request
  const permittedDeleteUsers = new Set(
    [accessRequest.userId, accessRequest.createdBy, group?.createdBy].filter((u) => u),
  );
  if (!permittedDeleteUsers.has(callingUser.userId) && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
    return ApiResponse.forbidden({
      message: `Not permitted to delete access request for group ${groupId} and userId ${userId}. Permitted users are ${[
        ...permittedDeleteUsers,
      ].join(', ')}, or an admin.`,
    });
  }

  await accessRequestStore.deleteAccessRequestIfExists(groupId, userId);

  return ApiResponse.success(accessRequest);
});
