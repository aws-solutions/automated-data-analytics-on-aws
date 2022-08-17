/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EventBridgeEvent, ExternalIdentityProvider, IdentityProviderEvents } from '@ada/microservice-common';
import { IdentityProviderStore } from '../../../../api/components/ddb/identity-provider';
import {
  describeIdentityProvider,
  isUniqueProvider,
} from '../../../../api/components/cognito/cognito-identity-service-provider';
import { find } from 'lodash';

export interface DeleteIdentityProviderEvent {
  eventSource: string;
  eventName: string;
  awsRegion: string;
  requestParameters: RequestParameters;
  requestID: string;
  eventID: string;
  eventType: string;
}

export interface RequestParameters {
  userPoolId: string;
  providerName: string;
}

/**
 * Delete identity provider if idp is deleted from Cognito UI
 * @param event initial payload from event
 * @param context lambda context
 */
export const handler = async (
  event: EventBridgeEvent<DeleteIdentityProviderEvent>,
  _context: any,
): Promise<ExternalIdentityProvider | undefined | Error> => {
  const { USER_POOL_ID } = process.env;
  const { eventName, requestParameters } = event.detail;
  const { userPoolId, providerName } = requestParameters;

  if (userPoolId !== USER_POOL_ID) {
    throw new Error(`expected ${USER_POOL_ID} in event but got user pool id ${userPoolId} instead`);
  }

  if (eventName !== IdentityProviderEvents.DELETE_IDP) {
    throw new Error(`expected ${IdentityProviderEvents.DELETE_IDP} in event but got
    user pool id ${eventName} instead`);
  }

  let deletedProvider;
  let id;
  // determine if provider is Amazon or Google
  try {
    const response = await IdentityProviderStore.getInstance().listIdentityProvider({});

    // find the identity provider whose type equals the providerName
    const provider = find(response.providers, function (idp: ExternalIdentityProvider) {
      return idp.type.includes(providerName);
    }) as ExternalIdentityProvider;

    if (provider && isUniqueProvider(provider)) {
      id = provider.identityProviderId;
    }

    const idToDelete = id || providerName;
    const cognitoidP = await describeIdentityProvider(idToDelete);
    if (!cognitoidP) {
      deletedProvider = await IdentityProviderStore.getInstance().deleteIdentityProviderIfExists(idToDelete);
      if (!deletedProvider) {
        throw new Error(`Provider not found. Provider name: ${providerName}`);
      }
    }
  } catch (e: any) {
    throw new Error(`Could not delete provider ${providerName}. ${e.message}`);
  }

  return deletedProvider;
};
