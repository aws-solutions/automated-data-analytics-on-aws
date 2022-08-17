/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { IdentityProviderStore } from '../../../api/components/ddb/identity-provider';

/**
 * Handler for listing identity providers
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listIdentityProviders', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  // Any user may list identity providers so long as their api access policy allows
  const response = await IdentityProviderStore.getInstance().listIdentityProvider(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }

  return ApiResponse.success(response);
});
