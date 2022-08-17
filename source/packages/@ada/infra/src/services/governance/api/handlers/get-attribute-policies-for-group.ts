/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import VError from 'verror';

/**
 * Handler for getting the lens to apply for the given group and attributes
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getGovernancePolicyAttributes',
  async ({ requestParameters, requestArrayParameters }, _callingUser, _event, { log }) => {
    const { group } = requestParameters;
    const { namespaceAndAttributeIds } = requestArrayParameters;
    if (!group) {
      return ApiResponse.badRequest({ message: 'No group specified' });
    }

    try {
      const attributeIdToLensId = await AttributePolicyStore.getInstance().getLensIdsForAttributes(
        namespaceAndAttributeIds || [],
        group,
      );
      log.info(`attributeIdToLensId: ${attributeIdToLensId}`);
      return ApiResponse.success({ attributeIdToLensId });
    } catch (e: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'GetLensesError', cause: e },
          `Error retrieving lenses for group ${group} and attribute ids ${namespaceAndAttributeIds}`,
        ),
      );
    }
  },
);
