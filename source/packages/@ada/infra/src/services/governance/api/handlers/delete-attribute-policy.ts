/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import { buildNamespaceAndAttributeId } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';
import { getPrimaryAttributePolicyEntityToLock } from './policy-utils';

/**
 * Handler for deleting an attribute policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteGovernancePolicyAttributesGroup',
  async ({ requestParameters }, _callingUser, _event, { relationshipClient, log }) => {
    const { attributeId, ontologyNamespace, group } = requestParameters;

    // NB: Ontology attribute policy deletion is governed by api access policies
    // ie. Anyone with permissions to manage governance may delete any attribute policy
    const deletedPolicy = await AttributePolicyStore.getInstance().deleteAttributePolicyIfExists(
      ontologyNamespace,
      attributeId,
      group,
    );

    if (deletedPolicy) {
      // Remove all relationships to the attribute policy
      await relationshipClient.removeAllRelationships(
        entityIdentifier('GovernancePolicyAttributesGroup', {
          namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
          group,
        }),
      );
      log.info(`Deleted attribute policy for attribute ${ontologyNamespace}.${attributeId} and group ${group}`);
      return ApiResponse.success(deletedPolicy);
    }
    return ApiResponse.notFound({
      message: `No attribute policy found for attribute ${ontologyNamespace}.${attributeId} and group ${group}`,
    });
  },
  getPrimaryAttributePolicyEntityToLock,
);
