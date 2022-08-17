/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AttributePolicyStore } from '../components/ddb/attribute-policy-store';
import { buildUniqOntology } from '@ada/common';
import { entityIdentifier } from '@ada/api-client/types';
import { lockAndVerifyGroupsAndOntologies } from './policy-utils';

/**
 * Handler for creating/updating a batch of attribute policies
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putGovernancePolicyAttributes',
  async ({ body: { policies } }, callingUser, _event, { lockClient, relationshipClient }) => {
    const { userId } = callingUser;

    // NB: Ontology attribute policy create/update is governed by api access policies
    // ie. Anyone with permissions to manage governance may create/update any attribute policy
    const { locks: ontologyAndGroupLocks, policyIdentifiers } = await lockAndVerifyGroupsAndOntologies(
      callingUser,
      policies,
      lockClient,
    );
    const policyEntityIdentifiers = policyIdentifiers.map((policy) =>
      entityIdentifier('GovernancePolicyAttributesGroup', policy),
    );
    const locks = ontologyAndGroupLocks.concat(await lockClient.acquire(...policyEntityIdentifiers));

    // NOTE: refactor this to remove force update
    const writtenPolicies = await AttributePolicyStore.getInstance().batchPutAttributePolicy(userId, policies, true);

    // Relate each policy to its group and ontology
    await Promise.all(
      policyIdentifiers.map(async (policyIdentifier) => {
        const policyEntity = entityIdentifier('GovernancePolicyAttributesGroup', policyIdentifier);
        const { namespaceAndAttributeId, group: groupId } = policyIdentifier;
        const ontologyEntity = entityIdentifier('Ontology', buildUniqOntology(namespaceAndAttributeId));
        const groupEntity = entityIdentifier('IdentityGroup', { groupId });
        await relationshipClient.updateRelationships(callingUser, policyEntity, [ontologyEntity, groupEntity]);
      }),
    );

    await lockClient.release(...locks);

    return ApiResponse.success({ policies: writtenPolicies });
  },
  ApiLambdaHandler.doNotLockPrimaryEntity,
);
