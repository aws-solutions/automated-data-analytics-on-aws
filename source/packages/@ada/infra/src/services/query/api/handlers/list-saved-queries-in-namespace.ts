/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../components/ddb/saved-query';
import { isPrivateNamespace, validateNamespace } from '../../components/saved-query';

/**
 * Handler for listing saved queries
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'listQueryNamespaceSavedQueries',
  async ({ requestParameters }, callingUser) => {
    const { namespace } = requestParameters;

    const api = ApiClient.create(callingUser);
    await validateNamespace(api, callingUser, namespace);

    const paginationParameters = getPaginationParameters(requestParameters);

    const queryStore = isPrivateNamespace(callingUser, namespace)
      ? PrivateSavedQueryStore.getInstance()
      : PublicSavedQueryStore.getInstance();

    const response = await queryStore.listSavedQueriesWithinNamespace(namespace, paginationParameters);

    if (response.error) {
      return ApiResponse.badRequest({ message: response.error });
    }

    return ApiResponse.success(response);
  },
);
