/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessRequestAction, AccessRequestNotificationType, DefaultGroupIds } from '@ada/common';
import { AccessRequestStore } from '../../../../api/components/ddb/access-request';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { EventSource } from '@ada/microservice-common';
import { Group } from '@ada/api';
import { GroupStore } from '../../../../api/components/ddb/groups';
import { NotificationClient } from '../../../../api/components/notification/client';
import { getGroupOwnersToNotify } from './utils';
import uniq from 'lodash/uniq';

/**
 * Handler for approving or denying an access request
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityRequestAction',
  async ({ requestParameters, body: request }, caller, _event, { log }) => {
    const { groupId, userId, action } = requestParameters;

    const groupStore = GroupStore.getInstance();
    const accessRequestStore = AccessRequestStore.getInstance();

    const { reason } = request;

    const existingGroup = await groupStore.getGroup(groupId);
    log.debug(`Found group with id ${groupId}`);

    if (!existingGroup) {
      return ApiResponse.notFound({ message: `Not Found: no group was found with ${groupId}` });
    }

    // Only the owner of the group or an admin may approve an access request for a group
    if (caller.userId !== existingGroup.createdBy && !caller.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({ message: `User does not have permission to grant access request` });
    }

    // get current access request
    const accessRequest = await accessRequestStore.deleteAccessRequestIfExists(groupId, userId);

    if (!accessRequest) {
      return ApiResponse.notFound({ message: `No access request found for group ${groupId} and user ${userId}` });
    }

    const notificationClient = NotificationClient.getInstance();

    const response = {
      accessRequest,
      reason,
      action,
      caller: caller.userId,
      timestamp: new Date().toISOString(),
    };

    // Notify the user that the request was pertaining to, the user that created the request, and the group owners
    const usersToNotify = uniq(
      [accessRequest.createdBy, accessRequest.userId].concat(
        await getGroupOwnersToNotify(caller, existingGroup.createdBy!),
      ),
    );

    const notify = (type: AccessRequestNotificationType) =>
      notificationClient.send(
        ...usersToNotify.map((target) => ({
          source: EventSource.IDENTITY,
          type,
          target,
          payload: response,
        })),
      );

    switch (action) {
      case AccessRequestAction.DENY: {
        log.info(`action: ${AccessRequestAction.DENY}`);
        await notify(AccessRequestNotificationType.DENY);
        log.debug(`Notified users AccessRequestNotificationType: ${AccessRequestAction.DENY}`);
        return ApiResponse.success(response);
      }
      case AccessRequestAction.APPROVE: {
        log.info(`action: ${AccessRequestAction.APPROVE}`);

        if (!existingGroup?.members.includes(userId)) {
          existingGroup?.members.push(userId);
          await groupStore.putGroup(groupId, caller.userId, existingGroup as Group);
          log.debug(`Added user to group: ${groupId}`);
          await notify(AccessRequestNotificationType.APPROVE);
          log.debug(`Notified users AccessRequestNotificationType: ${AccessRequestAction.APPROVE}`);
          return ApiResponse.success(response);
        }
        return ApiResponse.badRequest({ message: `User already exists in group ${groupId}` });
      }
      default: {
        return ApiResponse.badRequest({
          message: `Path does not exist. Error actioning an accessRequest with groupId ${groupId} and userId ${userId}`,
        });
      }
    }
  },
);
