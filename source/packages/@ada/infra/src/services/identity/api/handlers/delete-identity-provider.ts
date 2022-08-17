/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { IdentityProviderStore } from '../../../api/components/ddb/identity-provider';
import { VError } from 'verror';
import {
  deleteIdentityProvider,
  disableExternalProviderInUserPoolClient,
  isUniqueProvider,
} from '../../../api/components/cognito/cognito-identity-service-provider';

/**
 * Handler for updating or creating a new identity provider
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteIdentityProvider',
  async ({ requestParameters }, _callingUser, _event, { log }) => {
    const { identityProviderId } = requestParameters;

    // Identity provider deletion is governed by the api access policies only
    const exisitingProvider = await IdentityProviderStore.getInstance().getIdentityProvider(identityProviderId);

    if (!exisitingProvider) {
      return ApiResponse.notFound(
        new VError({ name: 'EntityNotFound' }, `No identity provider found with id ${identityProviderId}`),
      );
    }
    // Cognito allows for one instance of social idp, e.g. Amazon or Google.
    const existingIdentityProviderId = isUniqueProvider(exisitingProvider)
      ? exisitingProvider.type
      : identityProviderId;

    // Disable the identity provider just in case it's still enabled
    await disableExternalProviderInUserPoolClient(existingIdentityProviderId);
    log.debug('Disabled identity provider in Cognito', { identityProviderId });

    // Delete the identity provider in cognito
    await deleteIdentityProvider(existingIdentityProviderId);
    log.info('Deleted provider in Cognito', { identityProviderId });

    // Delete the entity in dynamodb
    await IdentityProviderStore.getInstance().deleteIdentityProviderIfExists(identityProviderId);
    log.info('Deleted entity in dynamodb', { identityProviderId });

    return ApiResponse.success(exisitingProvider);
  },
);
