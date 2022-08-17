/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestStore, ListAccessRequestResponse } from '../../../../api/components/ddb/access-request';
import { ApiClient } from '@ada/api-client-lambda';
import { ApiError, ListIdentityGroupsResponse, ListIdentityRequestsResponse } from '@ada/api-client';
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';

const respond = (response: ListAccessRequestResponse): ApiResponse<ListIdentityRequestsResponse | ApiError> => {
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
};

/**
 * Handler for listing access requests
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listIdentityRequests', async ({ requestParameters }, callingUser) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  const { userId, groups: callerGroups } = callingUser;

  // When the user is an admin, they have access to all access requests
  if (callerGroups.includes(DefaultGroupIds.ADMIN)) {
    return respond(await AccessRequestStore.getInstance().listAccessRequest(paginationParameters));
  }

  // Non admins should only see requests for the groups they own
  const api = ApiClient.create(callingUser);

  // List all groups
  // NOTE: May wish to implement a "list my groups" api to reduce potential size/time of retrieving all groups
  const groups = [];
  let nextToken;
  do {
    const groupsResponse: ListIdentityGroupsResponse = await api.listIdentityGroups({ nextToken });
    nextToken = groupsResponse.nextToken;
    groups.push(...groupsResponse.groups);
  } while (nextToken);

  const ownedGroupIds = groups.filter((group) => group.createdBy === userId).map(({ groupId }) => groupId);

  return respond(
    await AccessRequestStore.getInstance().listAccessRequestsForGroupsOrUsers(paginationParameters, ownedGroupIds, [
      userId,
    ]),
  );
});
