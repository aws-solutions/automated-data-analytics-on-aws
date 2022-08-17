/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributeValuePolicyStore } from '../components/ddb/attribute-value-policy-store';
import { VError } from 'verror';

/**
 * Handler for getting the sql clause to apply for the given group and attributes
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getGovernancePolicyAttributeValues',
  async ({ requestParameters, requestArrayParameters }) => {
    const { group } = requestParameters;
    const { namespaceAndAttributeIds } = requestArrayParameters;

    if (!group) {
      return ApiResponse.badRequest({ message: 'No group specified' });
    }

    try {
      const attributeIdToSqlClause = await AttributeValuePolicyStore.getInstance().getSqlClausesForAttributes(
        namespaceAndAttributeIds || [],
        group,
      );
      return ApiResponse.success({ attributeIdToSqlClause });
    } catch (e: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'GetSqlClausesForAttributesError', cause: e },
          `Error retrieving sql clauses for group ${group} and attribute ids ${namespaceAndAttributeIds}`,
        ),
      );
    }
  },
);
