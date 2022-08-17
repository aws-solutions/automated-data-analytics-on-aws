/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IdentityProviderStore } from '../../../../../api/components/ddb/identity-provider';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../../event-bridge/delete-identity-provider-sync';

import {
  AttributeRequestMethod,
  ExternalIdentityProvider,
  GoogleProvider,
  IdentityProviderType,
  OIDCProvider,
} from '@ada/microservice-common';

const describeIdentityProviderMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    describeIdentityProvider: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(describeIdentityProviderMock(...args))),
    }),
  })),
}));

describe('delete-identity-provider-sync', () => {
  // Mock the identity provider store to point to our local dynamodb
  const testIdentityProviderStore = new (IdentityProviderStore as any)(getLocalDynamoDocumentClient());
  const now = '2021-01-01T00:00:00.000Z';
  const createUpdateDetails = {
    createdBy: 'creator',
    updatedBy: 'creator',
    createdTimestamp: now,
    updatedTimestamp: now,
  };
  const baseMockEventBridgeEvent = {
    region: '123',
    account: '123',
    version: '0',
    id: 'abc',
    time: '2021',
  };
  const identityProviderId = 'test';
  const OLD_ENV = process.env;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.resetAllMocks();
    jest.resetModules(); // clears the cache
    describeIdentityProviderMock.mockReset();
    process.env = { ...OLD_ENV }; // Make a copy
    IdentityProviderStore.getInstance = jest.fn(() => testIdentityProviderStore);
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should delete OIDC idp in store if idp is deleted in Cognito UI', async () => {
    // Put an existing idp in the store
    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
        attributeRequestMethod: AttributeRequestMethod.GET,
        issuer: 'https://an-issuer.example.com',
      } as OIDCProvider,
      type: IdentityProviderType.OIDC,
    };
    await testIdentityProviderStore.putIdentityProvider(identityProviderId, 'creator', identityProvider);

    // event simulates someone deleting idp from Cognito UI
    const response = await handler(
      {
        ...baseMockEventBridgeEvent,
        source: 'aws.cognito-idp',
        'detail-type': 'AWS API Call via CloudTrail',
        detail: {
          eventSource: 'cognito-idp.amazonaws.com',
          eventName: 'DeleteIdentityProvider',
          awsRegion: 'us-west-2',
          requestParameters: {
            userPoolId: 'user-pool-id',
            providerName: identityProviderId,
          },
          requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
          eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
          eventType: 'AwsApiCall',
        },
      },
      null,
    );
    const expectedIdentityProvider = {
      ...identityProvider,
      identityProviderId,
      ...createUpdateDetails,
    };

    // Check the idp is deleted in dynamodb
    expect(response).toEqual(expectedIdentityProvider);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toBeFalsy();
  });

  it('should delete Google idp in store if idp is deleted in Cognito UI', async () => {
    const id = 'google-idp-id';

    // Put an existing idp in the store
    const identityProvider: Omit<ExternalIdentityProvider, 'identityProviderId'> = {
      description: 'a brief description',
      name: 'provider name',
      details: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['a', 'b', 'c'],
      } as GoogleProvider,
      type: IdentityProviderType.Google,
    };
    await testIdentityProviderStore.putIdentityProvider(id, 'creator', identityProvider);

    // event simulates someone deleting idp from Cognito UI
    const response = await handler(
      {
        ...baseMockEventBridgeEvent,
        source: 'aws.cognito-idp',
        'detail-type': 'AWS API Call via CloudTrail',
        detail: {
          eventSource: 'cognito-idp.amazonaws.com',
          eventName: 'DeleteIdentityProvider',
          awsRegion: 'us-west-2',
          requestParameters: {
            userPoolId: 'user-pool-id',
            providerName: IdentityProviderType.Google,
          },
          requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
          eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
          eventType: 'AwsApiCall',
        },
      },
      null,
    );
    const expectedIdentityProvider = {
      ...identityProvider,
      identityProviderId: id,
      ...createUpdateDetails,
    };

    // Check the idp is deleted in dynamodb
    expect(response).toEqual(expectedIdentityProvider);
    expect(await testIdentityProviderStore.getIdentityProvider(identityProviderId)).toBeFalsy();
  });

  it('should throw error if provider name is not found in store', async () => {
    const userPoolId = 'user-pool-id';
    const fakeProviderName = 'does not exist';

    expect(async () => {
      await handler(
        {
          ...baseMockEventBridgeEvent,
          source: 'aws.cognito-idp',
          'detail-type': 'AWS API Call via CloudTrail',
          detail: {
            eventSource: 'cognito-idp.amazonaws.com',
            eventName: 'DeleteIdentityProvider',
            awsRegion: 'us-west-2',
            requestParameters: {
              userPoolId: userPoolId,
              providerName: fakeProviderName,
            },
            requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
            eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
            eventType: 'AwsApiCall',
          },
        },
        null,
      );
    }).rejects.toThrow(/does not exist/i);
  });

  it('should throw error if user pool id doesnt match env var', async () => {
    process.env.USER_POOL_ID = 'us-west-2_SnfE0vbMn';
    const userPoolId = 'user-pool-id';

    expect(async () => {
      await handler(
        {
          ...baseMockEventBridgeEvent,
          source: 'aws.cognito-idp',
          'detail-type': 'AWS API Call via CloudTrail',
          detail: {
            eventSource: 'cognito-idp.amazonaws.com',
            eventName: 'DeleteIdentityProvider',
            awsRegion: 'us-west-2',
            requestParameters: {
              userPoolId: userPoolId,
              providerName: identityProviderId,
            },
            requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
            eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
            eventType: 'AwsApiCall',
          },
        },
        null,
      );
    }).rejects.toThrow(`expected ${process.env.USER_POOL_ID} in event but got user pool id ${userPoolId} instead`);
  });
  it('should throw error if eventName doesnt match', async () => {
    const userPoolId = 'user-pool-id';

    await expect(handler({
        ...baseMockEventBridgeEvent,
        source: 'aws.cognito-idp',
        'detail-type': 'AWS API Call via CloudTrail',
        detail: {
          eventSource: 'cognito-idp.amazonaws.com',
          eventName: 'UNEXPECTED_EVENT_NAME',
          awsRegion: 'us-west-2',
          requestParameters: {
            userPoolId: userPoolId,
            providerName: identityProviderId,
          },
          requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
          eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
          eventType: 'AwsApiCall',
        },
      },
      null,
    )).rejects.toMatchObject({ message: expect.stringMatching(/UNEXPECTED_EVENT_NAME/i)});
  });

  it('should throw error idp cannot be deleted in store', async () => {
    const userPoolId = 'user-pool-id';

    const spy = jest.spyOn(testIdentityProviderStore, 'listIdentityProvider').mockImplementation(() => {
      throw new Error('cannot list providers');
    });

    expect(async () => {
      await handler(
        {
          ...baseMockEventBridgeEvent,
          source: 'aws.cognito-idp',
          'detail-type': 'AWS API Call via CloudTrail',
          detail: {
            eventSource: 'cognito-idp.amazonaws.com',
            eventName: 'DeleteIdentityProvider',
            awsRegion: 'us-west-2',
            requestParameters: {
              userPoolId: userPoolId,
              providerName: identityProviderId,
            },
            requestID: 'de45bee6-7c23-486c-a2a5-f9cc52478054',
            eventID: '1c2a0990-3482-4f4d-a7cf-615a2ab2d7c6',
            eventType: 'AwsApiCall',
          },
        },
        null,
      );
    }).rejects.toThrow(`Could not delete provider ${identityProviderId}`);
    expect(spy).toBeCalledTimes(1);
  });
});
