/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { OntologyStore } from '../../components/ddb/ontology';

/**
 * Handler for listing ontology attributes
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listOntologies', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Any authenticated user may read ontology attributes (so long as their api access policy allows)
  const response = await OntologyStore.getInstance().listOntologies(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
});
