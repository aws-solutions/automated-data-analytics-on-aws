/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultLensPolicyStore } from '../components/ddb/default-lens-policy-store';
import { VError } from 'verror';

/**
 * Handler for getting the default lens to apply for the given data product
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getGovernancePolicyDefaultLensDomainDataProduct',
  async ({ requestParameters }) => {
    const { domainId, dataProductId } = requestParameters;

    try {
      const policy = await DefaultLensPolicyStore.getInstance().getDefaultLensPolicy(domainId, dataProductId);
      if (policy) {
        return ApiResponse.success(policy);
      }
      return ApiResponse.notFound({
        message: `No default lens policy found for domain ${domainId} and data product ${dataProductId}`,
      });
    } catch (e: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'GetDefaultLensPolicyError', cause: e },
          `Error retrieving default lens policy for domain ${domainId} and data product ${dataProductId}`,
        ),
      );
    }
  },
);
