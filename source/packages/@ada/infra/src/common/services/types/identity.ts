/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export enum IdentityProviderType {
  SAML = 'SAML',
  OIDC = 'OIDC',
  Google = 'Google',
  Amazon = 'LoginWithAmazon',
}

export enum AttributeRequestMethod {
  GET = 'GET',
  POST = 'POST',
}

export interface BaseProvider {
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export type GoogleProvider = BaseProvider;

export type AmazonProvider = BaseProvider;

export interface OIDCProvider extends BaseProvider {
  attributeRequestMethod: AttributeRequestMethod;
  issuer: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  attributesUrl?: string;
  jwksUri?: string;
}

export interface SAMLProvider {
  metadataURL: string;
  /// XML content
  metadataFile: string;
  signOut: boolean;
}

export interface ExternalIdentityProvider {
  identityProviderId: string;
  name: string;
  description: string;
  type: IdentityProviderType;
  details: OIDCProvider | SAMLProvider | AmazonProvider | GoogleProvider;
  attributeMapping?: { [key: string]: string };
  identifiers?: string[];
  enabled?: boolean;
  updatedTimestamp?: string;
}

/**
 * Defines events to do with Identity Providers
 */
export enum IdentityProviderEvents {
  // Delete identity provider event
  DELETE_IDP = 'DeleteIdentityProvider',
}
