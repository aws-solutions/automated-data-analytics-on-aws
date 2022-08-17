/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { IdentityProviderStore } from '../../../api/components/ddb/identity-provider';

/**
 * Handler for retrieving an identity provider
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getIdentityProvider', async ({ requestParameters }) => {
  const { identityProviderId } = requestParameters;

  // Any user may retrieve an identity provider so long as their api access policy allows
  const identityProvider = await IdentityProviderStore.getInstance().getIdentityProvider(identityProviderId);

  if (!identityProvider) {
    return ApiResponse.notFound({
      message: `Not Found: no identity provider was found with identityProviderId ${identityProviderId}`,
    });
  }

  return ApiResponse.success(identityProvider);
});
