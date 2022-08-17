/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductPolicyStore } from '../components/ddb/data-product-policy-store';
import { DefaultLensPolicyStore } from '../components/ddb/default-lens-policy-store';
import { entityIdentifier } from '@ada/api-client/types';
import { isPermittedForFullAccessByDataProductPolicy } from '@ada/infra-common/services';
import { lockAndVerifyDataProductAndGroups } from './policy-utils';

/**
 * Handler for creating/updating a default lens policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putGovernancePolicyDefaultLensDomainDataProduct',
  async ({ requestParameters, body: defaultLensPolicy }, callingUser, _event, { lockClient, relationshipClient }) => {
    const { domainId, dataProductId } = requestParameters;
    const { userId } = callingUser;

    const { locks } = await lockAndVerifyDataProductAndGroups(
      callingUser,
      requestParameters,
      Object.keys(defaultLensPolicy.defaultLensOverrides),
      lockClient,
    );

    const dataProductPolicy = await DataProductPolicyStore.getInstance().getDataProductPolicy(
      domainId,
      dataProductId,
    );

    if (dataProductPolicy && !isPermittedForFullAccessByDataProductPolicy(dataProductPolicy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Not authorized to delete default lens policy for data product ${domainId}.${dataProductId}`,
      });
    }

    const writtenPolicy = await DefaultLensPolicyStore.getInstance()
    .putDefaultLensPolicy(domainId, dataProductId, userId, {
      ...defaultLensPolicy,
      domainId,
      dataProductId,
    });

    // Relate the policy to the groups and data product
    await relationshipClient.updateRelationships(
      callingUser,
      entityIdentifier('GovernancePolicyDefaultLensDomainDataProduct', { domainId, dataProductId }),
      locks.map((lock) => lock.entity),
    );

    await lockClient.release(...locks);

    return ApiResponse.success(writtenPolicy);
  },
);
