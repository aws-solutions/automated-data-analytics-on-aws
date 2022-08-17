/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyEntity } from '@ada/api-client';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Handler for creating/updating a batch of attribute policies
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteGovernancePolicyAttributes',
  async ({ body: { policies } }, _callingUser, _event, { lockClient, relationshipClient }) => {
    // NB: Ontology attribute policy deletion is governed by api access policies
    // ie. Anyone with permissions to manage governance may delete any attribute policy

    // Lock the policies to delete
    const policyEntities = policies.map((policy) => entityIdentifier('GovernancePolicyAttributesGroup', policy));
    const locks = await lockClient.acquire(...policyEntities);

    // Delete the policies
    const deletedPolicies = (await AttributePolicyStore.getInstance().batchDeleteAttributePolicy(policies)).filter(
      (policy) => policy,
    ) as AttributePolicyEntity[];

    // Remove all relationships for the policy
    await Promise.all(policyEntities.map((policyEntity) => relationshipClient.removeAllRelationships(policyEntity)));

    // Release the locks on the deleted policies
    await lockClient.release(...locks);

    return ApiResponse.success({ policies: deletedPolicies });
  },
  ApiLambdaHandler.doNotLockPrimaryEntity,
);
