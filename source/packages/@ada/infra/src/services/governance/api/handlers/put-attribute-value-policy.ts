/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributeValuePolicyStore } from '../components/ddb/attribute-value-policy-store';
import { buildNamespaceAndAttributeId } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';
import {
  getPrimaryAttributePolicyEntityToLock,
  lockAndVerifyGroupAndOntology,
  validateAttributeValuePolicies,
} from './policy-utils';

/**
 * Handler for creating/updating an attribute value policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putGovernancePolicyAttributeValuesGroup',
  async (
    { requestParameters, body: attributeValuePolicy },
    callingUser,
    _event,
    { lockClient, relationshipClient }
  ) => {
    const { attributeId, ontologyNamespace, group } = requestParameters;
    const { userId } = callingUser;

    // Make sure the attribute value policy to write is valid
    const policyToWrite = {
      ...attributeValuePolicy,
      namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
      group,
    };
    await validateAttributeValuePolicies(callingUser, [policyToWrite]);

    // NB: Ontology attribute value policy create/update is governed by api access policies
    // ie. Anyone with permissions to manage governance may create/update any attribute value policy
    const { locks, policyIdentifier } = await lockAndVerifyGroupAndOntology(callingUser, requestParameters, lockClient);

    const writtenPolicy = await AttributeValuePolicyStore.getInstance().putAttributeValuePolicy(
      ontologyNamespace,
      attributeId,
      group,
      userId,
      policyToWrite,
    );

    // Relate the policy to the group and ontology
    await relationshipClient.updateRelationships(
      callingUser,
      entityIdentifier('GovernancePolicyAttributeValuesGroup', policyIdentifier),
      locks.map((lock) => lock.entity),
    );

    await lockClient.release(...locks);

    return ApiResponse.success(writtenPolicy);
  },
  getPrimaryAttributePolicyEntityToLock,
);
