/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { AttributePolicyIdentifier } from '@ada/api-client';
import { EntityIdentifier } from '@ada/api-client/types';
import { buildUniqAttribute } from '@ada/common';
import { filterRelatedEntitiesOfType } from '../../../services/api/components/entity/relationships/client';

const buildAttributePolicyRequestParameters = ({ namespaceAndAttributeId, group }: AttributePolicyIdentifier) => {
  const { ontologyNamespace, attributeId } = buildUniqAttribute(namespaceAndAttributeId);
  return { ontologyNamespace, attributeId, group };
};

/**
 * Deletes all attribute and attribute value policies in the related entities
 */
export const deleteRelatedAttributeAndAttributeValuePolicies = async (
  api: ApiClient,
  relatedEntities: EntityIdentifier[],
) => {
  const relatedAttributePolicies = filterRelatedEntitiesOfType(relatedEntities, 'GovernancePolicyAttributesGroup');
  const relatedAttributeValuePolicies = filterRelatedEntitiesOfType(
    relatedEntities,
    'GovernancePolicyAttributeValuesGroup',
  );

  await Promise.all<any>([
    ...relatedAttributePolicies
      .map(buildAttributePolicyRequestParameters)
      .map((policy) => api.deleteGovernancePolicyAttributesGroup(policy)),
    ...relatedAttributeValuePolicies
      .map(buildAttributePolicyRequestParameters)
      .map((policy) => api.deleteGovernancePolicyAttributeValuesGroup(policy)),
  ]);
};
