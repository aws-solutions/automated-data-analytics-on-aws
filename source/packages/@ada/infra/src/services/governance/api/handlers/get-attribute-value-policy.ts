/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributeValuePolicyStore } from '../components/ddb/attribute-value-policy-store';
import { VError } from 'verror';

/**
 * Handler for getting the attribute value policy for a given attribute and group
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getGovernancePolicyAttributeValuesGroup',
  async ({ requestParameters }, _callingUser, _event, { log }) => {
    const { attributeId, ontologyNamespace, group } = requestParameters;

    try {
      const policy = await AttributeValuePolicyStore.getInstance().getAttributeValuePolicy(
        ontologyNamespace,
        attributeId,
        group,
      );

      if (policy) {
        log.info(`Attribute Value Policy found for attributeId ${ontologyNamespace}.${attributeId} and group ${group}`);
        return ApiResponse.success(policy);
      }
      return ApiResponse.success({
        message: `No attribute value policy found for attributeId ${ontologyNamespace}.${attributeId} and group ${group}`,
      });
    } catch (e: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'GetAttributeValuePolicyError', cause: e },
          `Error retrieving attribute value policy for attributeId ${ontologyNamespace}.${attributeId} and group ${group}`,
        ),
      );
    }
  },
);
