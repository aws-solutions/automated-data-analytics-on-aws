import { mapIdentityProviderDetails, isUniqueProvider, createIdentityProvider, updateIdentityProvider, deleteIdentityProvider } from '../cognito-identity-service-provider';
import {
  IdentityProviderType
} from '@ada/microservice-common';

const mockCreateIdentityProvider = jest.fn();
const mockUpdateIdentityProvider = jest.fn();
const mockDeleteIdentityProvider = jest.fn();
jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    createIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockCreateIdentityProvider(...args))),
    }),
    updateIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockUpdateIdentityProvider(...args))),
    }),
    deleteIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteIdentityProvider(...args))),
    }),
  })),
}));

const originalEnv = process.env;

const testBaseExternalIdentitiyProps = {
  identityProviderId: 'testIdentityProviderId',
  name: 'testName',
  description: 'testDescription',
  identifiers: ['identifier1', 'identifier2'],
  attributeMapping: {
    'key1': 'value1',
    'key2': 'value2',
  }
};

const testSharedExternalIdentityDetails: any = {
  clientSecret: 'testClientSecret',
  clientId: 'testClientId',
  scopes: ['scope1', 'scope2']
}

const testExternalIdentityPropsForGoogle = {
  identityProviderId: 'testIdentityProviderId',
  name: 'testName',
  description: 'testDescription',
  type: IdentityProviderType.Google,
  details: testSharedExternalIdentityDetails,
};

const testExternalIdentityPropsForAmazon = {
  ...testBaseExternalIdentitiyProps,
  type: IdentityProviderType.Amazon,
  details: testSharedExternalIdentityDetails,
};

const expectMapIdentityProviderDetailsOutputForAmazon = {
  client_id: 'testClientId',
  client_secret: 'testClientSecret',
  authorize_scopes: 'scope1 scope2'
}

describe('cognito-identity-service-provider', () => {
  describe('mapIdentityProviderDetails', () => {

    it('should map Identity Provider Details for Google', () => {
      const result = mapIdentityProviderDetails(testExternalIdentityPropsForGoogle);

      expect(result).toEqual({
        client_id: 'testClientId',
        client_secret: 'testClientSecret',
        authorize_scopes: 'scope1 scope2'
      });
    });

    it('should map Identity Provider Details for Amazon', () => {
      const result = mapIdentityProviderDetails(testExternalIdentityPropsForAmazon);

      expect(result).toEqual(expectMapIdentityProviderDetailsOutputForAmazon);
    });

    it('should map Identity Provider Details for SAML', () => {
      const details: any = {
        metadataFile: 'testMetadataFile',
        metadataURL: 'testMetadataURL',
        signOut: true,
      };

      const result = mapIdentityProviderDetails({
        ...testBaseExternalIdentitiyProps,
        type: IdentityProviderType.SAML,
        details,
      });

      expect(result).toEqual({
        MetadataFile: 'testMetadataFile',
        MetadataURL: 'testMetadataURL',
        IDPSignout: 'true',
      });
    });

    it('should map Identity Provider Details for OIDC', () => {
      const details: any = {
        ...testSharedExternalIdentityDetails,
        issuer: 'testIssuer',
        attributeRequestMethod: 'testAttributeRequestMethod',
        authorizeUrl: 'testAuthorizeUrl',
        tokenUrl: 'testTokenUrl',
        attributesUrl: 'testAttributesUrl',
        jwksUri: 'testJwksUri',
      };

      const result = mapIdentityProviderDetails({
        ...testBaseExternalIdentitiyProps,
        type: IdentityProviderType.OIDC,
        details,
      });

      expect(result).toEqual({
        client_id: 'testClientId',
        client_secret: 'testClientSecret',
        authorize_scopes: 'scope1 scope2',
        attributes_request_method: 'testAttributeRequestMethod',
        oidc_issuer: 'testIssuer',
        authorize_url: 'testAuthorizeUrl',
        token_url: 'testTokenUrl',
        attributes_url: 'testAttributesUrl',
        jwks_uri: 'testJwksUri',
      });
    });
  });

  describe('isUniqueProvider', () => {
    it('should return true for Google', () => {
      expect(isUniqueProvider(testExternalIdentityPropsForGoogle)).toBe(true);
    });

    it('should return true for Amazon', () => {
      expect(isUniqueProvider(testExternalIdentityPropsForAmazon)).toBe(true);
    });
  });

  describe('AwsCognitoIdentityServiceProviderInstance', () => {
    beforeAll(() => {
      jest.resetModules();
      process.env = {
        ...originalEnv,
        USER_POOL_ID: 'testUserPoolId',
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    describe('createIdentityProvider', () => {
      it('call cognito createIdentityProvider', async () => {
        await createIdentityProvider('identityProviderId', testExternalIdentityPropsForAmazon);
  
        expect(mockCreateIdentityProvider).toHaveBeenCalledWith({
          UserPoolId: 'testUserPoolId',
          ProviderDetails: expectMapIdentityProviderDetailsOutputForAmazon,
          ProviderType: IdentityProviderType.Amazon,
          ProviderName: IdentityProviderType.Amazon,
          AttributeMapping: testExternalIdentityPropsForAmazon.attributeMapping,
          IdpIdentifiers: testExternalIdentityPropsForAmazon.identifiers,
        });
      });
    });

    describe('updateIdentityProvider', () => {
      it('call cognito updateIdentityProvider', async () => {
        await updateIdentityProvider('identityProviderId', testExternalIdentityPropsForAmazon);
  
        expect(mockUpdateIdentityProvider).toHaveBeenCalledWith({
          UserPoolId: 'testUserPoolId',
          ProviderDetails: expectMapIdentityProviderDetailsOutputForAmazon,
          ProviderName: 'identityProviderId',
          AttributeMapping: testExternalIdentityPropsForAmazon.attributeMapping,
        });
      });
    });

    describe('deleteIdentityProvider', () => {
      it('call cognito updateIdentityProvider', async () => {
        await deleteIdentityProvider('identityProviderId');
  
        expect(mockDeleteIdentityProvider).toHaveBeenCalledWith({
          UserPoolId: 'testUserPoolId',
          ProviderName: 'identityProviderId',
        });
      });
    });
  });
});