/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { GroupStore } from '../../../api/components/ddb/groups';
import { deleteRelatedAttributeAndAttributeValuePolicies } from '@ada/microservice-common/utils/attribute-policy';
import { entityIdentifier } from '@ada/api-client/types';
import { filterRelatedEntitiesOfType } from '../../../api/components/entity/relationships/client';

const DEFAULT_GROUP_IDS = new Set<string>(Object.values(DefaultGroupIds));

/**
 * Handler for deleting a group
 */
export const handler = ApiLambdaHandler.for(
  'deleteIdentityGroup',
  async ({ requestParameters, body: _group }, callingUser, _event, { relationshipClient, log }) => {
    const { groupId } = requestParameters;

    if (DEFAULT_GROUP_IDS.has(groupId)) {
      return ApiResponse.forbidden({
        message: `Not permitted to delete built-in group ${groupId}`,
      });
    }

    const groupEntity = entityIdentifier('IdentityGroup', { groupId });
    const relatedEntities = await relationshipClient.getRelatedEntities(groupEntity);

    // Forbid deletion if referenced in an override for a default lens policy of a group
    // NOTE: Consider in the future mutating the default lens policy to remove the group override.
    // To avoid race conditions where new overrides might be missed, this requires either locking across api calls, or a
    // new api to delete an override.
    const relatedDefaultLensPolicies = filterRelatedEntitiesOfType(
      relatedEntities,
      'GovernancePolicyDefaultLensDomainDataProduct',
    );

    if (relatedDefaultLensPolicies.length > 0) {
      const dataProductNames = relatedDefaultLensPolicies
        .map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`)
        .join(', ');
      return ApiResponse.badRequest({
        message: `Group ${groupId} cannot be deleted as it is referenced in a default lens override for the following data products: ${dataProductNames}`,
      });
    }

    // Forbid deletion if referenced in a data product policy
    // NOTE: Consider in the future mutating the data product policy to remove the group permissions (same as above)
    const relatedDataProductPolicies = filterRelatedEntitiesOfType(
      relatedEntities,
      'GovernancePolicyDomainDataProduct',
    );
    if (relatedDataProductPolicies.length > 0) {
      const dataProductNames = relatedDataProductPolicies
        .map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`)
        .join(', ');
      return ApiResponse.badRequest({
        message: `Group ${groupId} cannot be deleted as it is referenced in a data product policy: ${dataProductNames}`,
      });
    }

    const groupStore = GroupStore.getInstance();
    const existingGroup = await groupStore.getGroup(groupId);

    // Check if the group exists
    if (!existingGroup) {
      return ApiResponse.notFound({
        message: `No group found with id ${groupId}`,
      });
    }

    if (existingGroup.createdBy !== callingUser.userId && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `Only the group owner ${existingGroup.createdBy} or an admin may delete group ${groupId}`,
      });
    }

    // We delete all of the associated attribute and attribute value policies
    await deleteRelatedAttributeAndAttributeValuePolicies(ApiClient.create(callingUser), relatedEntities);
    log.debug(`Deleted all associated attribute and attribute value policies`, { relatedEntities });
    // Finally delete the group
    await relationshipClient.removeAllRelationships(groupEntity);
    log.info(`Removed all relationships associated the the group ${groupId}`);
    const deletedGroup = await GroupStore.getInstance().deleteGroupIfExists(groupId);
    log.info(`Deleted group with id: ${groupId}`);
    return ApiResponse.success(deletedGroup!);
  },
);
