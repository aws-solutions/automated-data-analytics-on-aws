/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmplifyContext, MOCK_AMPLIFY_CONTEXT } from '../AmplifyProvider';
import { AppLayoutProvider, AppLayoutProviderProps, NotificationsRenderer } from '$northstar-plus';
import { BaseMetaProvider, BaseMetaProviderProps } from '.';
import { DeepPartial } from '$ts-utils';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { TEST_USER } from '../../../common/entity/user';
import { UserContext } from '../UserProvider';
import { isNil, isObject, omitBy } from 'lodash';
import React, { PropsWithChildren, useMemo } from 'react';

type MOCKED = 'MOCKED';
export interface MockMetaProviderProps extends PropsWithChildren<{}> {
  /**
   * @default false App layout provider
   */
  appLayout?: AppLayoutProviderProps | boolean;
  /**
   * @default true Api cache and hooks is available
   */
  api?: React.ComponentType | boolean;
  /**
   * @default false Northstar theme is not loaded
   */
  northstar?: React.ComponentType | boolean;
  /**
   * @default true will use MemoryRouter
   */
  router?: React.ComponentType | boolean | MemoryRouterProps;
  /**
   * @default false Amplify is not loaded
   */
  amplify?: React.ComponentType | boolean | DeepPartial<AmplifyContext | MOCKED>;
  /**
   * @default MOCKED User is mocked
   */
  user?: React.ComponentType | boolean | DeepPartial<UserContext | MOCKED>;
  /**
   * @default false
   */
  indexing?: React.ComponentType | boolean;
}

export const MockMetaProvider = ({ children, ...config }: MockMetaProviderProps) => {
  const router = useMemo<BaseMetaProviderProps['router']>(() => {
    if (config.router === false) return React.Fragment;
    if (isObject(config.router)) {
      return ({ children, ...props }: PropsWithChildren<MemoryRouterProps>) => (
        <MemoryRouter {...props} {...config.router}>
          {children}
        </MemoryRouter>
      );
    }
    return MemoryRouter;
  }, [config.router]);

  const amplify = useMemo<BaseMetaProviderProps['amplify']>(() => {
    if (config.amplify == null || config.amplify === false) return React.Fragment;
    if (isObject(config.amplify)) {
      return ({ children }: PropsWithChildren<{}>) => (
        <AmplifyContext.Provider value={config.amplify as AmplifyContext}>{children}</AmplifyContext.Provider>
      );
    }
    if (config.amplify === true || config.amplify === 'MOCKED') {
      return ({ children }: PropsWithChildren<{}>) => (
        <AmplifyContext.Provider value={MOCK_AMPLIFY_CONTEXT}>{children}</AmplifyContext.Provider>
      );
    }
    return undefined; // default provider
  }, [config.amplify]);

  const user = useMemo<BaseMetaProviderProps['user']>(() => {
    if (config.user === false) return React.Fragment;
    if (isObject(config.user)) {
      return ({ children }: PropsWithChildren<{}>) => (
        <UserContext.Provider value={config.user as UserContext}>{children}</UserContext.Provider>
      );
    }
    if (config.user == null || config.user === 'MOCKED') {
      return ({ children }: PropsWithChildren<{}>) => (
        <UserContext.Provider value={{ userProfile: TEST_USER }}>{children}</UserContext.Provider>
      );
    }
    return undefined; // default provider
  }, [config.user]);

  const api = useMemo<BaseMetaProviderProps['api']>(() => {
    if (config.api === false) return React.Fragment;
    return undefined; // default provider
  }, [config.api]);

  const northstar = useMemo<BaseMetaProviderProps['northstar']>(() => {
    if (config.northstar == null || config.northstar === false) return React.Fragment;
    return undefined; // default provider
  }, [config.northstar]);

  const indexing = useMemo<BaseMetaProviderProps['indexing']>(() => {
    if (config.indexing == null || config.indexing === false) return React.Fragment;
    return undefined; // default provider
  }, [config.indexing]);

  const props = useMemo<BaseMetaProviderProps>(
    () =>
      omitBy(
        {
          api,
          router,
          amplify,
          user,
          northstar,
          indexing,
        },
        isNil,
      ),
    [api, router, amplify, user, northstar, indexing],
  );

  if (config.appLayout) {
    return (
      <BaseMetaProvider {...props}>
        <AppLayoutProvider {...(config.appLayout === true ? {} : config.appLayout)}>
          <NotificationsRenderer />
          {children}
        </AppLayoutProvider>
      </BaseMetaProvider>
    );
  }

  return <BaseMetaProvider {...props}>{children}</BaseMetaProvider>;
};
