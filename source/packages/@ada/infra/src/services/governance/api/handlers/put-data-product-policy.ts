/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductPolicyStore } from '../components/ddb/data-product-policy-store';
import { entityIdentifier } from '@ada/api-client/types';
import { isPermittedForFullAccessByDataProductPolicy } from '@ada/microservice-common';
import { lockAndVerifyDataProductAndGroups } from './policy-utils';

/**
 * Handler for creating/updating a data product's policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putGovernancePolicyDomainDataProduct',
  async ({ requestParameters, body: dataProductPolicy }, callingUser, _event, { lockClient, relationshipClient }) => {
    const { domainId, dataProductId } = requestParameters;
    const { userId } = callingUser;

    const store = DataProductPolicyStore.getInstance();
    const existingPolicy = await store.getDataProductPolicy(domainId, dataProductId);

    // Policy will not exist the first time a data product is created and the internal api call is made to write the
    // initial data product. Otherwise, we grant permissions to edit the data product policy based on the existing
    // permissions described by the policy.
    if (existingPolicy && !isPermittedForFullAccessByDataProductPolicy(existingPolicy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Not authorized to update permissions for data product ${domainId}.${dataProductId}`,
      });
    }

    // Verify that the data product and groups involved exist. Even for the internal api call when a data product is
    // created, the data product will exist at this point.
    const { locks } = await lockAndVerifyDataProductAndGroups(
      callingUser,
      requestParameters,
      Object.keys(dataProductPolicy.permissions),
      lockClient,
      !!existingPolicy,
    );

    // Write the policy
    const writtenPolicy = await store.putDataProductPolicy(domainId, dataProductId, userId, {
      ...dataProductPolicy,
      domainId,
      dataProductId,
    });

    // Relate the policy to the groups and data product
    await relationshipClient.updateRelationships(
      callingUser,
      entityIdentifier('GovernancePolicyDomainDataProduct', { domainId, dataProductId }),
      locks.map((lock) => lock.entity),
    );

    await lockClient.release(...locks);

    return ApiResponse.success(writtenPolicy);
  },
);
