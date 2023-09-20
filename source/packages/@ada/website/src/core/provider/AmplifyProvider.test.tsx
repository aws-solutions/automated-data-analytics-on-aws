/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmplifyProvider, forceAuthRefreshToken, useAmplifyContext, useTokenRefreshListener } from './AmplifyProvider';
import { Auth } from '@aws-amplify/auth';
import { Hub } from 'aws-amplify';
import { TEST_COGNITO_USER } from '$common/entity/user';
import { act, render } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';

jest.mock('../../runtime-config', () => ({
  RuntimeConfig: {
    userPoolId: 'ap-southeast-1_ABCDEFGHI',
    userPoolClientId: 'mockUserPoolClientId',
    apiUrl: 'https://test.api/',
    region: 'ap-southeast-1',
    accountId: '123456789012',
    oauthScopes: ['phone', 'profile', 'openid', 'email', 'aws.cognito.signin.user.admin'],
    oauthDomain: 'test.auth.ap-southeast-1.amazoncognito.com',
    ouathResponseType: 'code',
    athenaProxyApiUrl: 'athena-proxy-test.api:443',
  },
}));

describe('core/provider/AmplifyProvider', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should render provider', async () => {
    const currentAuthenticatedUser = jest.spyOn(Auth, 'currentAuthenticatedUser');
    currentAuthenticatedUser.mockImplementation(() => Promise.resolve(TEST_COGNITO_USER));
    const federatedSignIn = jest.spyOn(Auth, 'federatedSignIn');
    federatedSignIn.mockImplementation(jest.fn());
    const refreshListener = jest.fn();

    const Tester = () => {
      const context = useAmplifyContext();
      useTokenRefreshListener(refreshListener);
      useImmediateEffect(context.refreshToken);
      return <pre>{JSON.stringify(context.cognitoUser)}</pre>;
    };

    const { container } = render(
      <AmplifyProvider>
        <Tester />
      </AmplifyProvider>,
    );

    await act(async () => delay(1000));

    act(() => {
      Hub.dispatch('auth', { event: 'cognitoHostedUI_failure', data: { message: 'test' } });
    });

    act(() => {
      forceAuthRefreshToken();
    });

	await act(async () => delay(1000));

    expect(container).toBeDefined();
    expect(currentAuthenticatedUser).toBeCalled();
    expect(federatedSignIn).toBeCalled();
  });
});
