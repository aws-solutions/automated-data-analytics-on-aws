/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductPolicyStore } from '../components/ddb/data-product-policy-store';
import { DefaultGroupIds } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Handler for deleting a data product policy
 */
export const handler = ApiLambdaHandler.for(
  'deleteGovernancePolicyDomainDataProduct',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { userId, groups } = callingUser;
    const { domainId, dataProductId } = requestParameters;

    const policyStore = DataProductPolicyStore.getInstance();
    const existingPolicy = await policyStore.getDataProductPolicy(domainId, dataProductId);
    if (!existingPolicy) {
      return ApiResponse.notFound({
        message: `No data product policy found for domain ${domainId} and data product ${dataProductId}`,
      });
    }

    if (existingPolicy.createdBy !== userId && !groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `The data product policy is owned by ${existingPolicy.createdBy}. A data product policy may only be deleted by its owner, or a user in the ${DefaultGroupIds.ADMIN} group.`,
      });
    }

    const deletedPolicy = await policyStore.deleteDataProductPolicyIfExists(domainId, dataProductId);

    // Remove all relationships to the data product policy
    await relationshipClient.removeAllRelationships(
      entityIdentifier('GovernancePolicyDomainDataProduct', {
        domainId,
        dataProductId,
      }),
    );
    log.info(`Deleted data product policy for domain ${domainId} and data product id ${dataProductId}`);
    return ApiResponse.success(deletedPolicy!);
  },
);
