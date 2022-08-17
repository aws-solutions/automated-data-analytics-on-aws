/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { ExternalIdentityProvider, IdentityProviderType } from '@ada/microservice-common';
import { IdentityProviderStore } from '../../../api/components/ddb/identity-provider';
import { SAMLProvider } from '@ada/common';
import { VError } from 'verror';
import {
  createOrUpdateIdentityProvider,
  disableExternalProviderInUserPoolClient,
  enableExternalProviderInUserPoolClient,
  isUniqueProvider,
} from '../../../api/components/cognito/cognito-identity-service-provider';

/**
 * Handler for updating or creating a new identity provider
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('putIdentityProvider', async ({ requestParameters, body }, { userId }) => {
  const { identityProviderId } = requestParameters;
  let newIdentityProviderId: string;

  // Identity provider create/update is governed by the api access policy only
  try {
    const identityProviderToWrite = body as ExternalIdentityProvider;
    // by default, if not specified, the provider should be kept as enabled. Otherwise just take the value provided by the consumer
    identityProviderToWrite.enabled =
      identityProviderToWrite.enabled === undefined ? true : !!identityProviderToWrite.enabled;

    if (identityProviderToWrite.type === IdentityProviderType.SAML) {
      const details = identityProviderToWrite.details as SAMLProvider;
      // WAF blocks the XML for SAML metadataFile upload so the UI base64 encodes it first, so we need to decode before handling downstream.
      if (details.metadataFile != null) {
        details.metadataFile = Buffer.from(details.metadataFile, 'base64').toString('utf-8');
      }
    }
    // for google / amazon providers the 'name' and 'type' must be the same value
    newIdentityProviderId = isUniqueProvider(identityProviderToWrite)
      ? identityProviderToWrite.type
      : identityProviderId;

    await createOrUpdateIdentityProvider(identityProviderId, newIdentityProviderId!, identityProviderToWrite);

    try {
      if (identityProviderToWrite.enabled) {
        await enableExternalProviderInUserPoolClient(newIdentityProviderId!);
      } else {
        await disableExternalProviderInUserPoolClient(newIdentityProviderId!);
      }
    } catch (err: any) {
      return ApiResponse.badRequest(
        new VError(
          { name: 'EnableIdentityProviderError', cause: err },
          `Error enabling/disabling provider in user pool client, identity provider id ${newIdentityProviderId}`,
        ),
      );
    }

    return ApiResponse.success(
      await IdentityProviderStore.getInstance().putIdentityProvider(
        identityProviderId,
        userId,
        identityProviderToWrite,
      ),
    );
  } catch (err: any) {
    return ApiResponse.badRequest(
      new VError(
        { name: 'PutIdentityProviderError', cause: err },
        `Error storing identity provider with id with ID ${identityProviderId}`,
      ),
    );
  }
});
