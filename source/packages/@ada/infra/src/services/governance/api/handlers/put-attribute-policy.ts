/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import { entityIdentifier } from '@ada/api-client/types';
import { getPrimaryAttributePolicyEntityToLock, lockAndVerifyGroupAndOntology } from './policy-utils';

/**
 * Handler for creating/updating an attribute policy
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putGovernancePolicyAttributesGroup',
  async ({ requestParameters, body: attributePolicy }, callingUser, _event, { relationshipClient, lockClient }) => {
    const { attributeId, ontologyNamespace, group } = requestParameters;
    const { userId } = callingUser;

    // NB: Ontology attribute policy create/update is governed by api access policies
    // ie. Anyone with permissions to manage governance may create/update any attribute policy
    const { locks, policyIdentifier } = await lockAndVerifyGroupAndOntology(callingUser, requestParameters, lockClient);

    // Write the policy
    const writtenPolicy = await AttributePolicyStore.getInstance().putAttributePolicy(
      ontologyNamespace,
      attributeId,
      group,
      userId,
      {
        ...attributePolicy,
        ...policyIdentifier,
      },
    );

    // Relate the policy to the group and ontology
    await relationshipClient.updateRelationships(
      callingUser,
      entityIdentifier('GovernancePolicyAttributesGroup', policyIdentifier),
      locks.map((lock) => lock.entity),
    );

    await lockClient.release(...locks);

    return ApiResponse.success(writtenPolicy);
  },
  getPrimaryAttributePolicyEntityToLock,
);
