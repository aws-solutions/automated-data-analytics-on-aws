/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductPolicyStore } from '../components/ddb/data-product-policy-store';
import { DefaultLensPolicyStore } from '../components/ddb/default-lens-policy-store';
import { entityIdentifier } from '@ada/api-client/types';
import { isPermittedForFullAccessByDataProductPolicy } from '@ada/infra-common/services';

/**
 * Handler for deleting a default lens policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteGovernancePolicyDefaultLensDomainDataProduct',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { domainId, dataProductId } = requestParameters;

    const dataProductPolicy = await DataProductPolicyStore.getInstance().getDataProductPolicy(
      domainId,
      dataProductId,
    );

    if (dataProductPolicy && !isPermittedForFullAccessByDataProductPolicy(dataProductPolicy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Not authorized to delete default lens policy for data product ${domainId}.${dataProductId}`,
      });
    }

    const deletedPolicy = await DefaultLensPolicyStore.getInstance().deleteDefaultLensPolicyIfExists(
      domainId,
      dataProductId,
    );

    if (deletedPolicy) {
      // Remove all relationships to the default lens policy
      await relationshipClient.removeAllRelationships(
        entityIdentifier('GovernancePolicyDefaultLensDomainDataProduct', { domainId, dataProductId }),
      );
      log.info(`Deleted default lens policy: ${deletedPolicy}`);
      return ApiResponse.success(deletedPolicy);
    }
    return ApiResponse.notFound({
      message: `No default lens policy found for domain ${domainId} and data product ${dataProductId}`,
    });
  },
);
