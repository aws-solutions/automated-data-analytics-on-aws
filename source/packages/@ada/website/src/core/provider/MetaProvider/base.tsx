/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmplifyProvider } from '../AmplifyProvider';
import { ApiProvider } from '../ApiProvider';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ENV_TEST } from '$config';
import { I18nProvider } from '$strings'
import { IndexingProvider } from '$core/provider/IndexingProvider';
import { NorthStarThemeProvider } from 'aws-northstar';
import { UserProvider } from '../UserProvider';
import React, { PropsWithChildren } from 'react';

const Router = (ENV_TEST ? MemoryRouter : BrowserRouter) as new (...args: any[]) => any;

// enable overwriting provider for testing
export interface BaseMetaProviderProps extends PropsWithChildren<{}> {
  api?: React.ComponentType;
  northstar?: React.ComponentType;
  router?: React.ComponentType;
  amplify?: React.ComponentType;
  user?: React.ComponentType;
  indexing?: React.ComponentType;
}

export const BaseMetaProvider = ({
  children,
  api,
  northstar,
  router,
  amplify,
  user,
  indexing,
}: BaseMetaProviderProps) => {
  // Helpers to enable disabling providers for testing purposes
  const RouterComponent = router || Router;
  const ApiProviderComponent = api || ApiProvider;
  const NorthStarThemeProviderComponent = northstar || NorthStarThemeProvider;
  const AmplifyProviderComponent = amplify || AmplifyProvider;
  const UserProviderComponent = user || UserProvider;
  const IndexingProviderComponent = indexing || IndexingProvider;

  return (
    <I18nProvider locale="en">
      <NorthStarThemeProviderComponent>
        <AmplifyProviderComponent>
          <RouterComponent>
            <ApiProviderComponent>
              <UserProviderComponent>
                <IndexingProviderComponent>{children}</IndexingProviderComponent>
              </UserProviderComponent>
            </ApiProviderComponent>
          </RouterComponent>
        </AmplifyProviderComponent>
      </NorthStarThemeProviderComponent>
    </I18nProvider>
  );
};
