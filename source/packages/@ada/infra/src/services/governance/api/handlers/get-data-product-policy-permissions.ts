/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DataProductPolicyStore } from '../components/ddb/data-product-policy-store';
import { VError } from 'verror';
import { pick } from 'lodash';

/**
 * Handler for getting a data product's policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getGovernancePolicyDomainDataProductPermissions',
  async ({ requestParameters, requestArrayParameters }, _callingUser, _event, { log }) => {
    const { domainId, dataProductId } = requestParameters;
    const { groups } = requestArrayParameters;

    try {
      const dataProductPolicy = await DataProductPolicyStore.getInstance().getDataProductPolicy(
        domainId,
        dataProductId,
      );
      log.info('Data Product Policy: ', { dataProductPolicy });

      // Check if dataProductPolicy is undefined
      if (!dataProductPolicy) {
        return ApiResponse.notFound({
          message: `Not Found: data product policy for data product ${domainId}.${dataProductId}`,
        });
      }

      const groupAccessPermissions = pick(dataProductPolicy?.permissions, groups);

      return ApiResponse.success(groupAccessPermissions);
    } catch (e: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'GetPermissionsDataProductPolicyError', cause: e },
          `Error getting the permissions of a data product policy for data product ${domainId}.${dataProductId}`,
        ),
      );
    }
  },
);
