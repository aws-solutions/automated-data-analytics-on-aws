/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestEntity, GroupEntity } from '@ada/api-client';
import { AccessRequestStore } from '../../../../api/components/ddb/access-request';
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { CallingUser, DefaultGroupIds } from '@ada/common';

/**
 * Returns whether or not the given user is permitted to retrieve the access request
 */
const isPermittedToRetrieveRequest = (
  callingUser: CallingUser,
  accessRequest: AccessRequestEntity,
  group: GroupEntity,
): boolean =>
  // User is an admin
  callingUser.groups.includes(DefaultGroupIds.ADMIN) ||
  [
    // User owns the group for which access is requested
    group.createdBy,
    // User is the subject of the access request
    accessRequest.userId,
    // User was the requester
    accessRequest.createdBy,
  ].includes(callingUser.userId);

/**
 * Handler for getting an access request by group and user id
 */
export const handler = ApiLambdaHandler.for('getIdentityRequest', async ({ requestParameters }, callingUser) => {
  const { groupId, userId } = requestParameters;

  const accessRequest = await AccessRequestStore.getInstance().getAccessRequest(groupId, userId);
  const group = await ApiClient.create(callingUser).getIdentityGroup({ groupId });

  // Note that we return 404 for the "not permitted" case since knowledge of its existence is essentially the same as
  // retrieving the access request
  if (!accessRequest || !isPermittedToRetrieveRequest(callingUser, accessRequest, group)) {
    return ApiResponse.notFound({
      message: `Not Found: no access request was found with groupId ${groupId} and userId ${userId}`,
    });
  }

  return ApiResponse.success(accessRequest);
});
