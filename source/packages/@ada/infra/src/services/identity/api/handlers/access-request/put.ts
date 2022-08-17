/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestNotificationType, DefaultGroupIds } from '@ada/common';
import { AccessRequestStore } from '../../../../api/components/ddb/access-request';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { EventSource } from '@ada/microservice-common';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { NotificationClient } from '../../../../api/components/notification/client';
import { getGroupOwnersToNotify } from './utils';

/**
 * Handler for creating/updating an access request
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityRequest',
  async ({ requestParameters, body: accessRequest }, callingUser, _event, { log }) => {
    const { groupId, userId } = requestParameters;
    const accessRequestStore = AccessRequestStore.getInstance();
    const groupStore = GroupStore.getInstance();

    // If editing an access request, make sure that the user editing is either the creator or the subject of the access request, or an admin.
    const existingAccessRequest = await accessRequestStore.getAccessRequest(groupId, userId);
    if (existingAccessRequest) {
      const permittedEditUsers = new Set([existingAccessRequest.userId, existingAccessRequest.createdBy]);
      if (!permittedEditUsers.has(callingUser.userId) && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
        return ApiResponse.forbidden({
          message: `Not permitted to edit access request for group ${groupId} and user ${userId}. Permitted users are ${[
            ...permittedEditUsers,
          ].join(', ')} or an admin.`,
        });
      }
    }

    const group = await groupStore.getGroup(groupId);
    if (!group) {
      return ApiResponse.notFound({
        message: `The group with groupId ${groupId} does not exist.`,
      });
    }

    const accessRequestIdentifier = { groupId, userId };

    // First, write the new access request
    const writtenAccessRequest = await accessRequestStore.putAccessRequest(
      accessRequestIdentifier,
      callingUser.userId,
      {
        ...accessRequest,
        ...accessRequestIdentifier,
      },
    );

    // Notify the group owner of the access request
    const owners = await getGroupOwnersToNotify(callingUser, group.createdBy!);
    log.info(`Notify the group owner(s) ${owners.join(', ')} of the access request, id: ${accessRequestIdentifier}`);
    await NotificationClient.getInstance().send(
      ...owners.map((target) => ({
        source: EventSource.IDENTITY,
        type: AccessRequestNotificationType.REQUEST,
        target,
        payload: {
          ...accessRequest,
          userId,
          groupId,
        },
      })),
    );

    return ApiResponse.success(writtenAccessRequest);
  },
);
