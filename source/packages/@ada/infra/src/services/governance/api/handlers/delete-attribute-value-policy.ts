/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributeValuePolicyStore } from '../components/ddb/attribute-value-policy-store';
import { buildNamespaceAndAttributeId } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';
import { getPrimaryAttributePolicyEntityToLock } from './policy-utils';

/**
 * Handler for deleting an attribute value policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteGovernancePolicyAttributeValuesGroup',
  async ({ requestParameters }, _callingUser, _event, { relationshipClient, log }) => {
    const { ontologyNamespace, attributeId, group } = requestParameters;

    // NB: Ontology attribute value policy deletion is governed by api access policies
    // ie. Anyone with permissions to manage governance may delete any attribute value policy
    const deletedPolicy = await AttributeValuePolicyStore.getInstance().deleteAttributeValuePolicyIfExists(
      ontologyNamespace,
      attributeId,
      group,
    );

    if (deletedPolicy) {
      // Remove all relationships to the attribute value policy
      await relationshipClient.removeAllRelationships(
        entityIdentifier('GovernancePolicyAttributeValuesGroup', {
          namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
          group,
        }),
      );
      log.info(`Deleted attribute value policy for attribute ${ontologyNamespace}.${attributeId} and group ${group}`);
      return ApiResponse.success(deletedPolicy);
    }

    return ApiResponse.notFound({
      message: `No attribute value policy found for attribute ${ontologyNamespace}.${attributeId} and group ${group}`,
    });
  },
  getPrimaryAttributePolicyEntityToLock,
);
