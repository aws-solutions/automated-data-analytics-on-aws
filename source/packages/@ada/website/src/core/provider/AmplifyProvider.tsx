/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmplifyAuthenticator, AmplifyToast } from '@aws-amplify/ui-react';
import { Auth, CognitoHostedUIIdentityProvider, CognitoUser } from '@aws-amplify/auth';
import { AuthState, onAuthUIStateChange } from '@aws-amplify/ui-components';
import {
  ENV_DEVELOPMENT,
  ENV_STORYBOOK,
  ENV_TEST,
  clearUserSolutionPersistence,
  getSolutionPersistenceItem,
  setSolutionPersistenceItem,
} from '$config';
import { FederatedCognitoUser, TEST_COGNITO_USER } from '../../common/entity/user';
import { Hub, Logger } from 'aws-amplify';
import { RuntimeConfig } from '../../runtime-config';
import { throttle } from 'lodash';
import { useStatefulRef } from '$common/hooks';
import EventEmitter from 'eventemitter3';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';

const { region, userPoolId, userPoolClientId, oauthDomain, oauthScopes, ouathResponseType } = RuntimeConfig;

// Call Auth.configure instead of Amplify.configure to prevent token endpoint getting called during code flow
// https://lifesaver.codes/answer/auth-federatedsignin-with-google-calling-token-endpoint-twice-6330
!ENV_TEST &&
  !ENV_STORYBOOK &&
  Auth.configure({
    region: region,
    userPoolId: userPoolId,
    userPoolWebClientId: userPoolClientId,
    oauth: {
      label: 'Login using external Identity Providers',
      domain: oauthDomain,
      scope: oauthScopes,
      redirectSignIn: `${window.location.protocol}//${window.location.host}`,
      redirectSignOut: `${window.location.protocol}//${window.location.host}`,
      responseType: ouathResponseType,
    },
  });

ENV_DEVELOPMENT && (Logger.LOG_LEVEL = 'INFO');

export interface AmplifyContext {
  cognitoUser: FederatedCognitoUser;
  authState: AuthState;
  refreshToken: (bypassCache?: boolean) => Promise<void>;
  emitter: EventEmitter;
}

export const AmplifyContext = createContext<AmplifyContext | undefined>(undefined); //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const HUB_AUTH_FORCEREFRESH_EVENT = 'forceAuthRefreshToken';

export function forceAuthRefreshToken(): void {
  Hub.dispatch('auth', { event: HUB_AUTH_FORCEREFRESH_EVENT });
}

export const useAmplifyContext = () => {
  const context = useContext(AmplifyContext);
  if (context == null) throw new Error('AmplifyContext.Provider is not in scope');
  return context;
};

export const AmplifyProvider = ({ children }: PropsWithChildren<{}>) => {
  const [hubError, setHubError] = useState<string | undefined>();
  const [cognitoUser, setCognitoUser] = useState<CognitoUser>();
  const [authState, setAuthState] = useState<AuthState>();
  const authStateRef = useStatefulRef(authState);
  const emitter = useMemo(() => new EventEmitter(), []);
  const refreshToken = useMemo<AmplifyContext['refreshToken']>(() => {
    return throttle(async (bypassCache?: boolean): Promise<void> => {
      console.info('refreshing token:', bypassCache);
      try {
        const authUser: CognitoUser = await Auth.currentAuthenticatedUser({ bypassCache: bypassCache === true });
        setCognitoUser(authUser);
        emitter.emit('tokenRefreshed', authUser);
      } catch (error: any) {
        // force signin via hosted ui
        Auth.federatedSignIn({ provider: CognitoHostedUIIdentityProvider.Cognito });
      }
    }, 5000) as any;
  }, [emitter]);
  const context = useMemo<AmplifyContext>(() => {
    return {
      refreshToken,
      cognitoUser: cognitoUser as FederatedCognitoUser,
      authState: authState || AuthState.Loading,
      emitter,
    };
  }, [cognitoUser, authState, refreshToken, emitter]);

  useEffect(() => {
    Hub.listen('auth', ({ payload: { event, data } }) => {
      switch (event) {
        case 'cognitoHostedUI_failure': {
          setHubError(decodeURIComponent(data.message.replace(/\+/g, ' ')));
          break;
        }
        case HUB_AUTH_FORCEREFRESH_EVENT: {
          refreshToken(true);
          break;
        }
      }
    });

    onAuthUIStateChange(async (nextAuthState: AuthState, data?: object | undefined) => {
      ENV_DEVELOPMENT && console.info('AuthState:change:', nextAuthState, data);

      try {
        if (authStateRef.current === nextAuthState) return;
        setAuthState(nextAuthState);

        switch (nextAuthState) {
          case AuthState.SignIn:
            Auth.federatedSignIn({ provider: CognitoHostedUIIdentityProvider.Cognito });
            return;
          case AuthState.SignedIn: {
            const _cognitoUser = data as CognitoUser;

            // ensure previous user persisted data is removed when different user signs in
            const persistedUsername = getSolutionPersistenceItem('username', true);
            const username = _cognitoUser.getUsername();
            if (persistedUsername !== username) {
              clearUserSolutionPersistence();
            }
            setSolutionPersistenceItem('username', username, true);

            setCognitoUser(_cognitoUser);
            break;
          }
          case AuthState.SignedOut:
          case AuthState.SignOut: {
            // remove user specific persistent keys on sign out
            clearUserSolutionPersistence();
            break;
          }
          default:
            console.warn(`Unhandled user sign in state: ${nextAuthState}`);
        }
      } catch (error) {
        console.warn(error);
      }
    });
  }, [refreshToken]);

  return (
    <>
      {hubError && <AmplifyToast handleClose={() => setHubError(undefined)}>{hubError}</AmplifyToast>}
      <AmplifyAuthenticator>
        {/* Hide the sign-in form so we only have single federated sign-in experience */}
        <div slot="sign-in" />

        {cognitoUser && <AmplifyContext.Provider value={context}>{children}</AmplifyContext.Provider>}
      </AmplifyAuthenticator>
    </>
  );
};

export const useTokenRefreshListener = (listener: (user: CognitoUser) => void) => {
  const { emitter } = useAmplifyContext();
  useEffect(() => {
    emitter.on('tokenRefreshed', listener);

    return () => {
      emitter.off('tokenRefreshed', listener);
    };
  }, [emitter, listener]);
};

export const MOCK_AMPLIFY_CONTEXT: AmplifyContext = {
  authState: AuthState.SignedIn,
  refreshToken: () => Promise.resolve(),
  cognitoUser: TEST_COGNITO_USER as FederatedCognitoUser,
  emitter: new EventEmitter(),
};
