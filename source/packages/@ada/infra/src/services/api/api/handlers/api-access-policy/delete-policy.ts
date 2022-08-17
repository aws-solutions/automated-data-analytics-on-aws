/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyStore } from '../../../components/ddb/api-access-policy';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultApiAccessPolicyIds, DefaultGroupIds } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';

const DEFAULT_API_ACCESS_POLICY_IDS = new Set<string>(Object.values(DefaultApiAccessPolicyIds));

/**
 * Handler for creating/updating an api access policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteApiAccessPolicy',
  async ({ requestParameters }, callingUser, _event, { relationshipClient }) => {
    const { apiAccessPolicyId } = requestParameters;

    if (DEFAULT_API_ACCESS_POLICY_IDS.has(apiAccessPolicyId)) {
      return ApiResponse.forbidden({
        message: `Not permitted to delete the built in api access policy ${apiAccessPolicyId}`,
      });
    }

    const apiAccessPolicyEntity = entityIdentifier('ApiAccessPolicy', { apiAccessPolicyId });

    // Get any groups that reference this policy
    const referencedGroups = await relationshipClient.getRelatedEntitiesOfType(apiAccessPolicyEntity, 'IdentityGroup');
    if (referencedGroups.length > 0) {
      return ApiResponse.badRequest({
        message: `This api access policy cannot be deleted as it is referenced by the following groups: ${referencedGroups
          .map(({ groupId }) => groupId)
          .join(', ')}`,
      });
    }

    // Only admins may delete an api access policy
    if (!callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `You don't have access to delete the policy with Id ${apiAccessPolicyId}`,
      });
    }

    const deletedPolicy = await ApiAccessPolicyStore.getInstance().deleteApiAccessPolicyIfExists(apiAccessPolicyId);
    if (!deletedPolicy) {
      return ApiResponse.notFound({
        message: `No api access policy found with id ${apiAccessPolicyId}`,
      });
    }

    await relationshipClient.removeAllRelationships(apiAccessPolicyEntity);
    return ApiResponse.success(deletedPolicy);
  },
);
