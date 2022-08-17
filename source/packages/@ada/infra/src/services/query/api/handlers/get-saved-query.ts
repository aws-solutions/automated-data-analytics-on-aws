/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../components/ddb/saved-query';
import { isPrivateNamespace, validateNamespace } from '../../components/saved-query';

/**
 * Handler for getting a saved query
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getQuerySavedQuery', async ({ requestParameters }, callingUser) => {
  const { namespace, queryId } = requestParameters;
  const api = ApiClient.create(callingUser);
  await validateNamespace(api, callingUser, namespace);

  const queryStore = isPrivateNamespace(callingUser, namespace)
    ? PrivateSavedQueryStore.getInstance()
    : PublicSavedQueryStore.getInstance();

  const savedQueryIdentifier = { namespace, queryId };

  const savedQuery = await queryStore.getSavedQuery(savedQueryIdentifier);

  if (!savedQuery) {
    return ApiResponse.notFound({
      message: `Could not find the query ${queryId} in namespace ${namespace}`,
    });
  }

  return ApiResponse.success(savedQuery);
});
