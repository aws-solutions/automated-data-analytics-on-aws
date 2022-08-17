/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import VError from 'verror';

/**
 * Handler for getting the attribute policy for a given attribute and group
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getGovernancePolicyAttributesGroup', async ({ requestParameters }) => {
  const { attributeId, ontologyNamespace, group } = requestParameters;

  try {
    const policy = await AttributePolicyStore.getInstance().getAttributePolicy(
      ontologyNamespace,
      attributeId,
      group,
    );
    if (policy) {
      return ApiResponse.success(policy);
    }
    return ApiResponse.notFound({
      message: `No attribute policy found for attributeId ${ontologyNamespace}.${attributeId} and group ${group}`,
    });
  } catch (e: any) {
    return ApiResponse.badRequest(
      new VError(
        { name: 'GetAttributePolicyError', cause: e },
        `Error retrieving attribute policy for attributeId ${ontologyNamespace}.${attributeId} and group ${group}`,
      ),
    );
  }
});
