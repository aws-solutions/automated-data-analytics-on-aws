/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsCognitoIdentityServiceProviderInstance, CognitoIdentityServiceProvider as Cognito } from '@ada/aws-sdk';

import {
  ExternalIdentityProvider,
  GoogleProvider,
  IdentityProviderType,
  KeyValuePair,
  OIDCProvider,
  SAMLProvider,
} from '@ada/microservice-common';
import { IdentityProviderStore } from '../ddb/identity-provider';
import { PaginatedResponse } from '@ada/api';
import { PaginationParameters, fromToken, toToken } from '@ada/api-gateway';
import { VError } from 'verror';

const cognito = AwsCognitoIdentityServiceProviderInstance();

export interface ListUserPaginationToken {
  nextToken: string;
  remaining?: number;
}

export interface PaginatedUsersResponse extends PaginatedResponse {
  items: Cognito.UsersListType;
  error?: string;
}

// this is the max value: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ListUsers.html#CognitoUserPools-ListUsers-request-Limit
const DEFAULT_USER_PAGE_SIZE = 60;

/**
 * Map an external identity provider object to the respective object required by Cognito
 * @param provider an external provider object
 * @returns a mapped identity provider as required by Cognito APIs
 */
export const mapIdentityProviderDetails = (provider: ExternalIdentityProvider): any => {
  switch (provider.type) {
    case IdentityProviderType.Google:
    case IdentityProviderType.Amazon: {
      // both google and amazon providers have the same props
      const details = provider.details as GoogleProvider;

      return {
        client_id: details.clientId,
        client_secret: details.clientSecret,
        authorize_scopes: details.scopes.join(' '),
      };
    }
    case IdentityProviderType.SAML: {
      const details = provider.details as SAMLProvider;

      return {
        MetadataFile: details.metadataFile,
        MetadataURL: details.metadataURL,
        IDPSignout: details.signOut !== undefined ? details.signOut.toString() : undefined,
      };
    }
    case IdentityProviderType.OIDC: {
      const details = provider.details as OIDCProvider;

      return {
        client_id: details.clientId,
        client_secret: details.clientSecret,
        attributes_request_method: details.attributeRequestMethod,
        oidc_issuer: details.issuer,
        authorize_scopes: details.scopes.join(' '),
        authorize_url: details.authorizeUrl,
        token_url: details.tokenUrl,
        attributes_url: details.attributesUrl,
        jwks_uri: details.jwksUri,
      };
    }
    default:
      throw new VError({ name: 'ProviderTypeError' }, `Provider type ${provider.type}, not supported`);
  }
};

/**
 * Helper method to determine if provider only supports one instance of it eg. Amazon or Google providers
 * @param externalProvider the external identity provider details
 * @returns a boolean
 *
 */
export const isUniqueProvider = (externalProvider: ExternalIdentityProvider): boolean => {
  return externalProvider.type === IdentityProviderType.Amazon || externalProvider.type === IdentityProviderType.Google;
};

/**
 * Helper method to map the Cognito CreateIdentityProvider API
 * @param identityProviderId the identity provider id
 * @param externalProvider the external identity provider details
 * @returns a `CreateIdentityProviderResponse` in case of success
 */
export const createIdentityProvider = (
  identityProviderId: string,
  externalProvider: ExternalIdentityProvider,
): Promise<Cognito.CreateIdentityProviderResponse> =>
  cognito
    .createIdentityProvider({
      UserPoolId: process.env.USER_POOL_ID!,
      ProviderDetails: mapIdentityProviderDetails(externalProvider),
      ProviderType: externalProvider.type,
      ProviderName: isUniqueProvider(externalProvider) ? externalProvider.type : identityProviderId,
      AttributeMapping: externalProvider.attributeMapping,
      IdpIdentifiers: externalProvider.identifiers,
    } as Cognito.CreateIdentityProviderRequest)
    .promise();

/**
 * Helper method to map the Cognito UpdateIdentityProvider API
 * @param identityProviderId the identity provider id
 * @param externalProvider the external identity provider details
 * @returns a `UpdateIdentityProviderResponse` in case of success
 */
export const updateIdentityProvider = (
  identityProviderId: string,
  externalProvider: ExternalIdentityProvider,
): Promise<Cognito.UpdateIdentityProviderResponse> =>
  cognito
    .updateIdentityProvider({
      UserPoolId: process.env.USER_POOL_ID!,
      ProviderDetails: mapIdentityProviderDetails(externalProvider),
      ProviderName: identityProviderId,
      AttributeMapping: externalProvider.attributeMapping,
    })
    .promise();

/**
 * Helper method to delete an identity provider in cognito
 * @param identityProviderId
 */
export const deleteIdentityProvider = (identityProviderId: string) =>
  cognito
    .deleteIdentityProvider({
      UserPoolId: process.env.USER_POOL_ID!,
      ProviderName: identityProviderId,
    })
    .promise();

/**
 * Create or update (if already exists) the identity provider in Cognito
 * @param identityProviderId the identity provider id
 * @param externalProvider the external identity provider object
 * @returns a `UpdateUserPoolClientResponse` or `CreateIdentityProviderResponse` based if there was an update or create operation
 */
export const createOrUpdateIdentityProvider = async (
  identityProviderId: string,
  newIdentityProviderId: string,
  externalProvider: ExternalIdentityProvider,
): Promise<Cognito.UpdateUserPoolClientResponse | Cognito.CreateIdentityProviderResponse> => {
  try {
    const existingIdentityProvider = await describeIdentityProvider(newIdentityProviderId);

    const existingIdentityProviderInStore = await IdentityProviderStore.getInstance().getIdentityProvider(
      identityProviderId,
    );

    if (existingIdentityProvider && !existingIdentityProviderInStore && isUniqueProvider(externalProvider)) {
      throw new Error(
        `Duplicate identity provider cannot be created. Identity Providers such as Google, Amazon, etc can only be linked once to the same Cognito user pool.`,
      );
    }

    return updateIdentityProvider(newIdentityProviderId, externalProvider);
  } catch (err: any) {
    // if does not exists it will create
    if (err.code === 'ResourceNotFoundException') {
      return createIdentityProvider(newIdentityProviderId, externalProvider);
    }

    throw err;
  }
};

/**
 * Helper method for DescribeIdentityProvider Cognito API
 * @param identityProviderId the identity provider id
 * @returns a `DescribeIdentityProviderResponse` with the provider details return by Cognito
 */
export const describeIdentityProvider = (
  identityProviderId: string,
): Promise<Cognito.DescribeIdentityProviderResponse> =>
  cognito
    .describeIdentityProvider({
      ProviderName: identityProviderId,
      UserPoolId: process.env.USER_POOL_ID!,
    })
    .promise();
/**
 * Helper method for UpdateUserPoolClient Cognito API
 * @param identityProvidersToSupport list of string that contains the supported identity providers
 * @param existingUserPoolSettings existing settings (as returned from the Describe User Pool)
 * @returns an `UpdateUserPoolClientResponse` with details of the action
 */

export const updateUserPoolClient = (
  identityProvidersToSupport: string[],
  existingUserPoolSettings: Cognito.DescribeUserPoolClientResponse,
): Promise<Cognito.UpdateUserPoolClientResponse> => {
  const requiredUserPoolClientProps = {
    ClientId: process.env.USER_POOL_CLIENT_ID!,
    UserPoolId: process.env.USER_POOL_ID!,
  };

  const userPoolDetails = existingUserPoolSettings.UserPoolClient!;
  delete userPoolDetails.LastModifiedDate;
  delete userPoolDetails.CreationDate;
  delete userPoolDetails.ClientSecret;

  return cognito
    .updateUserPoolClient({
      ...requiredUserPoolClientProps,
      ...userPoolDetails,
      SupportedIdentityProviders: identityProvidersToSupport,
    })
    .promise();
};

/**
 * Try to enable the external provider in the user pool client (if is not enabled)
 * @param identityProviderId the identity provider id
 * @returns returns `UpdateUserPoolClientResponse` in case of update, undefined otherwise
 */
export const enableExternalProviderInUserPoolClient = async (
  identityProviderId: string,
): Promise<Cognito.UpdateUserPoolClientResponse | undefined> => {
  const requiredUserPoolClientProps = {
    ClientId: process.env.USER_POOL_CLIENT_ID!,
    UserPoolId: process.env.USER_POOL_ID!,
  };

  const userPoolClient = await cognito
    .describeUserPoolClient({
      ...requiredUserPoolClientProps,
    })
    .promise();
  const currentIdentityProviders = userPoolClient.UserPoolClient?.SupportedIdentityProviders || [];

  if (!currentIdentityProviders.includes(identityProviderId)) {
    return updateUserPoolClient(currentIdentityProviders.concat([identityProviderId]), userPoolClient);
  }

  return undefined;
};

/**
 * Try to disable the external provider in the user pool client (if is disabled)
 * @param identityProviderId the identity provider id
 * @returns returns `UpdateUserPoolClientResponse` in case of update, undefined otherwise
 */
export const disableExternalProviderInUserPoolClient = async (
  identityProviderId: string,
): Promise<Cognito.UpdateUserPoolClientResponse | undefined> => {
  const requiredUserPoolClientProps = {
    ClientId: process.env.USER_POOL_CLIENT_ID!,
    UserPoolId: process.env.USER_POOL_ID!,
  };

  const userPoolClient = await cognito
    .describeUserPoolClient({
      ...requiredUserPoolClientProps,
    })
    .promise();
  const currentIdentityProviders = userPoolClient.UserPoolClient?.SupportedIdentityProviders || [];

  if (currentIdentityProviders.includes(identityProviderId)) {
    return updateUserPoolClient(
      currentIdentityProviders.filter((q) => q !== identityProviderId),
      userPoolClient,
    );
  }

  return undefined;
};

/**
 * Describe the user pool
 * @returns user pool details
 */
export const describeUserPool = (): Promise<Cognito.DescribeUserPoolResponse> =>
  cognito
    .describeUserPool({
      UserPoolId: process.env.USER_POOL_ID!,
    })
    .promise();

/**
 * Get the details about a give user
 * @param username the username you want to get the details about
 * @returns user details
 */
export const adminGetUser = (username: string): Promise<Cognito.AdminGetUserResponse> =>
  cognito
    .adminGetUser({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: username,
    })
    .promise();

/**
 * Update the provided user attributes
 * @param username the username to update the attribute for
 * @param attributes a key value pair of the attribute key and value to be updated
 * @returns 'AdminUpdateUserAttributesResponse' in case of successful update
 */
export const adminUpdateUserAttributes = (
  username: string,
  attributes: KeyValuePair<string, string | boolean | number>[],
): Promise<Cognito.AdminUpdateUserAttributesResponse> =>
  cognito
    .adminUpdateUserAttributes({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: username,
      UserAttributes: attributes.map((q) => ({
        Name: q.key,
        Value: q.value.toString(),
      })),
    })
    .promise();

/**
 * List the Cognito User pool users
 * @param filter the filter to be applied to the query
 * @param pagination the pagination parameters
 * @returns the list of users with the next token or an error detail in case of error
 */
export const listUsers = async (
  { nextToken, limit, pageSize }: PaginationParameters,
  filter?: string,
): Promise<PaginatedUsersResponse> => {
  let paginationDetails: ListUserPaginationToken | undefined;

  try {
    paginationDetails = fromToken<ListUserPaginationToken>(nextToken);
  } catch (e) {
    return { error: `Invalid nextToken ${nextToken}`, items: [] };
  }

  const remainingBeforeThisPage = paginationDetails?.remaining || limit;

  const response = await cognito
    .listUsers({
      UserPoolId: process.env.USER_POOL_ID!,
      ...(filter ? { Filter: decodeURIComponent(filter) } : {}),
      Limit: Math.min(pageSize || DEFAULT_USER_PAGE_SIZE, remainingBeforeThisPage || DEFAULT_USER_PAGE_SIZE),
      PaginationToken: paginationDetails?.nextToken,
    })
    .promise();

  // Build the new next token
  let newToken: ListUserPaginationToken | undefined;
  if (response.PaginationToken) {
    // There are more items that can be fetched from dynamodb
    if (remainingBeforeThisPage) {
      // We had a limit, so check if we have reached that limit
      const remaining = remainingBeforeThisPage - (response.Users || []).length;
      if (remaining > 0) {
        // There are still more items to fetch, "remember" this in the token so we can honour the limit over multiple
        // paginated requests
        newToken = { nextToken: response.PaginationToken, remaining };
      }
    } else {
      // No limit was specified, so we don't set a remaining number of items to fetch
      newToken = { nextToken: response.PaginationToken };
    }
  }

  return { items: response.Users!, nextToken: toToken<ListUserPaginationToken>(newToken) };
};

/**
 * Create a user pool app client to be used for machine-to-machine authentication flow
 * Access Token, ID Token expires in 1 hour
 * Refresh Token expires in 1 day
 * @param clientName the name of the client to create
 * @returns the details of the newly created app client
 */
export const createUserPoolClient = (clientName: string): Promise<Cognito.CreateUserPoolClientResponse> => {
  return cognito
    .createUserPoolClient({
      ClientName: clientName,
      UserPoolId: process.env.USER_POOL_ID!,
      AllowedOAuthFlows: ['client_credentials'],
      IdTokenValidity: 1,
      AccessTokenValidity: 1,
      RefreshTokenValidity: 1,
      TokenValidityUnits: {
        IdToken: 'hours',
        AccessToken: 'hours',
        RefreshToken: 'days',
      },
      GenerateSecret: true,
      SupportedIdentityProviders: ['COGNITO'],
      AllowedOAuthScopes: [process.env.DEFAULT_SCOPE!],
      AllowedOAuthFlowsUserPoolClient: true,
    })
    .promise();
};

/**
 * Delete the app client from the user pool
 * @param clientId the id of the client to delete
 * @returns empty response in case of success, exception in case of error
 */
export const deleteUserPoolClient = (clientId: string) =>
  cognito
    .deleteUserPoolClient({
      ClientId: clientId,
      UserPoolId: process.env.USER_POOL_ID!,
    })
    .promise();
