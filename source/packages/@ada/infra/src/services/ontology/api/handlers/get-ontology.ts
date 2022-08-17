/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { OntologyStore } from '../../components/ddb/ontology';

/**
 * Handler for getting an ontology attribute by ontologyId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getOntology', async ({ requestParameters }) => {
  const { ontologyNamespace, ontologyId } = requestParameters;

  // Any authenticated user may read ontology attributes (so long as their api access policy allows)
  const ontology = await OntologyStore.getInstance().getOntology({ ontologyId, ontologyNamespace });
  if (!ontology) {
    return ApiResponse.notFound({ message: `Not Found: no ontology was found with ontologyId ${ontologyId}` });
  }
  return ApiResponse.success(ontology);
});
