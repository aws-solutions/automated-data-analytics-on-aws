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
export const handler = ApiLambdaHandler.for('getGovernancePolicyAttributesAttribute', async ({ requestParameters }) => {
  const { attributeId, ontologyNamespace } = requestParameters;

  try {
    console.log(`Query attrite values for ${ontologyNamespace}/${attributeId}`);
    const policies = await AttributePolicyStore.getInstance().getAttributePoliciesByAttributeId(
      ontologyNamespace,
      attributeId,
    );
    return ApiResponse.success({
      policies
    });
  } catch (e: any) {
    return ApiResponse.badRequest(
      new VError(
        { name: 'GetAttributePoliciesForAttributeError', cause: e },
        `Error retrieving attribute policy for attributeId ${ontologyNamespace}.${attributeId}`,
      ),
    );
  }
});
