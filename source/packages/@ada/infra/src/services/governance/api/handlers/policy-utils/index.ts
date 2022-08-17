/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { AttributePolicyIdentifier, AttributeValuePolicy } from '@ada/api-client';
import { CallingUser, buildNamespaceAndAttributeId, buildUniqOntology } from '@ada/common';
import { EntityIdentifier, OperationMeta, entityIdentifier } from '@ada/api-client/types';
import { ILockClient, LockedEntity } from '../../../../api/components/entity/locks/client';
import { LambdaRequestParameters, ORequestParameters, isApiClientErrorResponse } from '@ada/api-gateway';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';

type AttributePolicyOperations =
  | 'putGovernancePolicyAttributesGroup'
  | 'putGovernancePolicyAttributeValuesGroup'
  | 'deleteGovernancePolicyAttributesGroup'
  | 'deleteGovernancePolicyAttributeValuesGroup';

/**
 * Acquires locks on the ontology and group and verifies they exist
 */
export const lockAndVerifyGroupAndOntology = async (
  callingUser: CallingUser,
  { attributeId, ontologyNamespace, group }: ORequestParameters<AttributePolicyOperations>,
  lockClient: ILockClient,
) => {
  const policyIdentifier: AttributePolicyIdentifier = {
    namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
    group,
  };
  const { locks } = await lockAndVerifyGroupsAndOntologies(callingUser, [policyIdentifier], lockClient);
  return { locks, policyIdentifier };
};

/**
 * Acquires locks on the ontologies and groups and verifies they exist
 */
export const lockAndVerifyGroupsAndOntologies = async (
  callingUser: CallingUser,
  policies: AttributePolicyIdentifier[],
  lockClient: ILockClient,
) => {
  // Optimistically lock the ontology attribute and group
  const groupEntityIds = uniq(policies.map(({ group }) => group)).map((groupId) =>
    entityIdentifier('IdentityGroup', { groupId }),
  );
  const ontologyEntityIds = uniq(policies.map(({ namespaceAndAttributeId }) => namespaceAndAttributeId)).map(
    (namespaceAndAttributeId) => entityIdentifier('Ontology', buildUniqOntology(namespaceAndAttributeId)),
  );
  const locks: LockedEntity[] = await lockClient.acquire(...groupEntityIds, ...ontologyEntityIds);

  // Check that both the group and ontology exist
  const api = ApiClient.create(callingUser);
  await Promise.all<any>([
    ...groupEntityIds.map(({ identifierParts: [groupId] }) => api.getIdentityGroup({ groupId })),
    ...ontologyEntityIds.map(({ identifierParts: [ontologyNamespace, ontologyId] }) =>
      api.getOntology({ ontologyNamespace, ontologyId }),
    ),
  ]);

  const policyIdentifiers = uniqBy(
    policies,
    ({ namespaceAndAttributeId, group }) => `${namespaceAndAttributeId}.${group}`,
  );

  return { locks, policyIdentifiers };
};

/**
 * Acquires locks on the data product and groups and verifies they exist
 */
export const lockAndVerifyDataProductAndGroups = async (
  callingUser: CallingUser,
  {
    domainId,
    dataProductId,
  }: ORequestParameters<'putGovernancePolicyDefaultLensDomainDataProduct' | 'putGovernancePolicyDomainDataProduct'>,
  groupIds: string[],
  lockClient: ILockClient,
  checkDataProductExists = true,
) => {
  // Optimistically lock the data product and groups
  const dataProductEntityIdentifier = entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId });
  const groupEntityIdentifiers = groupIds.map((groupId) => entityIdentifier('IdentityGroup', { groupId }));
  const locks = await lockClient.acquire(dataProductEntityIdentifier, ...groupEntityIdentifiers);

  // Check that the data product and groups exist
  const api = ApiClient.create(callingUser);
  await Promise.all<Promise<any>>([
    ...(checkDataProductExists ? [api.getDataProductDomainDataProduct({ domainId, dataProductId })] : []),
    ...groupIds.map((groupId) => api.getIdentityGroup({ groupId })),
  ]);

  return { locks };
};

/**
 * Get the primary entity to lock for an attribute policy. This differs from the default implementation since we use
 * a composite identifier (namespaceAndOntologyId) but they are split in our api request parameters.
 */
export const getPrimaryAttributePolicyEntityToLock = <OName extends AttributePolicyOperations>(
  meta: OperationMeta<OName>,
  params: LambdaRequestParameters<OName>,
): EntityIdentifier | undefined => {
  const { requestParameters } = params as unknown as LambdaRequestParameters<AttributePolicyOperations>;
  return {
    type: meta.key,
    identifierParts: [
      requestParameters.group,
      buildNamespaceAndAttributeId(requestParameters.ontologyNamespace, requestParameters.attributeId),
    ],
  };
};

interface AttributePolicyValidationResult extends AttributePolicyIdentifier {
  isValid: boolean;
  message?: string;
}

/**
 * Validates that the given attribute value policies are correctly formed via calls to query parse/render service
 * @param callingUser the user making the request
 * @param policies the policies to validate
 */
export const validateAttributeValuePolicies = async (
  callingUser: CallingUser,
  policies: AttributeValuePolicy[],
): Promise<void> => {
  const api = ApiClient.create(callingUser);
  const log = Logger.getLogger();

  // Validate all policies in parallel
  const validationResults = await Promise.all(
    policies.map(async (policy) => {
      try {
        const { ontologyId } = buildUniqOntology(policy.namespaceAndAttributeId);
        await api.postQueryParseRenderValidateAttributeValuePolicy({
          postQueryParseRenderValidateAttributeValuePolicyRequest: {
            attribute: ontologyId,
            clause: policy.sqlClause,
          },
        });
        return <AttributePolicyValidationResult>{
          isValid: true,
          group: policy.group,
          namespaceAndAttributeId: policy.namespaceAndAttributeId,
        };
      } catch (e) {
        log.warn(`Error validating attribute value policy`, { e });
        return <AttributePolicyValidationResult>{
          isValid: false,
          group: policy.group,
          namespaceAndAttributeId: policy.namespaceAndAttributeId,
          message: isApiClientErrorResponse(e) ? (await e.json()).message : 'Attribute policy is not valid',
        };
      }
    }),
  );

  // Throw an error if there are any invalid policies
  const invalidPolicies = validationResults.filter(({ isValid }) => !isValid);
  if (invalidPolicies.length > 0) {
    const policyMessages = invalidPolicies
      .map(
        ({ group, namespaceAndAttributeId, message }) =>
          `Group ${group} and attribute ${namespaceAndAttributeId}: ${message}`,
      )
      .join(', ');
    throw new Error(`Cannot save invalid policies. ${policyMessages}`);
  }
};
