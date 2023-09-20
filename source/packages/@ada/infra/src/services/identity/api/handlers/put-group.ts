/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { DefaultUser } from '@ada/microservice-common';
import { GroupEntity } from '@ada/api';
import { GroupStore } from '../../../api/components/ddb/groups';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { entityIdentifier } from '@ada/api-client/types';

const log = Logger.getLogger({ tags: ['PutIdentityGroup'] });

/**
 * Handler for creating/updating a group
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityGroup',
  async ({ requestParameters, body: group }, callingUser, _event, { relationshipClient, lockClient }) => {
    const { groupId } = requestParameters;
    const { userId, groups } = callingUser;
    const isAdmin = groups.includes(DefaultGroupIds.ADMIN);

    // Lock the api access policies optimistically
    const apiAccessPolicyIdentifiers = group.apiAccessPolicyIds.map((apiAccessPolicyId) =>
      entityIdentifier('ApiAccessPolicy', { apiAccessPolicyId }),
    );
    const apiAccessPolicyLocks = await lockClient.acquire(...apiAccessPolicyIdentifiers);
    const api = ApiClient.create(callingUser);

    if (userId !== DefaultUser.SYSTEM) {
      // Make sure that all api access policies exist (unless the calling user is the system user, since at deployment
      // time this lambda is invoked to create the default groups before the API has been deployed)
      await Promise.all(
        group.apiAccessPolicyIds.map((apiAccessPolicyId) => api.getApiAccessPolicy({ apiAccessPolicyId })),
      );

      // Get the api access policies that the user already has access to
      const userPolicies = new Set(
        (await Promise.all(groups.map((_groupId) => api.getIdentityGroup({ groupId: _groupId }))))
          .map((q) => q.apiAccessPolicyIds)
          .flat(),
      );
      // Get the api access policies to be written that the user does not currently have privileges for
      const forbiddenPolicies = group.apiAccessPolicyIds.filter(
        (apiAccessPolicyId) => !userPolicies.has(apiAccessPolicyId),
      );

      // Only admin is allowed to assign privileges they do not already have to a group
      if (forbiddenPolicies.length > 0 && !isAdmin) {
        log.warn(
          'User attempted to create a group with API Access Polices that do not belong to the list of allowed policies',
          {
            userPolicies: [...userPolicies],
            requestedPolicies: group.apiAccessPolicyIds,
          },
        );

        return ApiResponse.badRequest({
          message: `Error assigning the requested API Access Polices to the new group. The following policies are not allowed: ${forbiddenPolicies.join(
            ',',
          )}`,
        });
      }
    }

    const groupStore = GroupStore.getInstance();

    // Only the group owner or admin is allowed to edit the group if it exists
    const existingGroup = await groupStore.getGroup(groupId);
    if (existingGroup && !(existingGroup.createdBy === userId || isAdmin || userId === DefaultUser.SYSTEM)) {
      return ApiResponse.forbidden({
        message: `The group is owned by ${existingGroup.createdBy}. A group may only be updated by its owner, or a user in the ${DefaultGroupIds.ADMIN} group.`,
      });
    }

    const writtenGroup = await groupStore.putGroup(
      groupId,
      userId,
      {
        ...group,
        // Updates to a group by the system user should not affect the members
        members: (userId === DefaultUser.SYSTEM ? existingGroup?.members : group.members) || [],
        groupId,
        // Allow the system to update an existing group on redeployment
      },
      userId === DefaultUser.SYSTEM,
    );

    // Relate the group to its api access policies
    await relationshipClient.updateRelationships(
      callingUser,
      entityIdentifier('IdentityGroup', { groupId }),
      apiAccessPolicyIdentifiers,
    );

    await lockClient.release(...apiAccessPolicyLocks);

    if (userId !== DefaultUser.SYSTEM) {
      return ApiResponse.success(writtenGroup);
    } else {
      return ApiResponse.success({} as GroupEntity);
    }
  },
);
