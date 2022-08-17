/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds, OntologyNamespace } from '@ada/common';
import { DefaultUser } from '../../../../common/services';
import { OntologyStore } from '../../components/ddb/ontology';
import { deleteRelatedAttributeAndAttributeValuePolicies } from '@ada/microservice-common/utils/attribute-policy';
import { entityIdentifier } from '@ada/api-client/types';
import { filterRelatedEntitiesOfType } from '../../../api/components/entity/relationships/client';
import type { OntologyIdentifier } from '@ada/api-client';

/**
 * Handler for deleting an ontology attribute
 */
export const handler = ApiLambdaHandler.for(
  'deleteOntology',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { userId, groups } = callingUser;
    const { ontologyNamespace, ontologyId } = requestParameters;
    const ontologyIdentifier: OntologyIdentifier = { ontologyNamespace, ontologyId };

    if (
      ontologyNamespace === OntologyNamespace.PII_CLASSIFICATIONS &&
      (userId !== DefaultUser.SYSTEM || !groups.includes(DefaultUser.SYSTEM))
    ) {
      return ApiResponse.forbidden({
        message: `Deletion of ontology attributes in namespace ${ontologyNamespace} is not permitted.`,
      });
    }

    // Check if there are any data products that reference this ontology
    const ontologyEntity = entityIdentifier('Ontology', ontologyIdentifier);
    log.info(`ontologyEntity: ${ontologyEntity}`);
    const relatedEntities = await relationshipClient.getRelatedEntities(ontologyEntity);
    log.info(`relatedEntities: ${relatedEntities}`);
    const relatedDataProductIdentifiers = filterRelatedEntitiesOfType(relatedEntities, 'DataProductDomainDataProduct');

    if (relatedDataProductIdentifiers.length > 0) {
      const dataProductNames = relatedDataProductIdentifiers
        .map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`)
        .join(', ');
      return ApiResponse.badRequest({
        message: `Ontology ${ontologyNamespace}.${ontologyId} cannot be deleted as it is referenced by data products: ${dataProductNames}`,
      });
    }

    const ontologyStore = OntologyStore.getInstance();
    const currentOntology = await ontologyStore.getOntology(ontologyIdentifier);

    // Check if the ontology exists
    if (!currentOntology) {
      return ApiResponse.notFound({
        message: `No ontology found in namespace ${ontologyNamespace} with id ${ontologyId}`,
      });
    }

    // Only the creator or an admin may delete ontology attributes
    if (currentOntology.createdBy !== userId && !groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `Deletion of ontology attributes in namespace ${ontologyNamespace} is not permitted.`,
      });
    }

    // We also delete the attribute policies and attribute value policies associated with the ontology
    await deleteRelatedAttributeAndAttributeValuePolicies(ApiClient.create(callingUser), relatedEntities);
    log.info(`Deletion of related entities from ontology`, { relatedEntities });

    // Finally delete the ontology attribute
    await relationshipClient.removeAllRelationships(ontologyEntity);
    const deletedOntology = await ontologyStore.deleteOntologyIfExists(ontologyIdentifier);
    log.info(`Deleted ontology`, { deletedOntology });
    return ApiResponse.success(deletedOntology!);
  },
);
