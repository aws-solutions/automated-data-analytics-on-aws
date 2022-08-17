/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiPermissions, PermissionsProvider } from '$api/hooks/permissions';
import { DEBUG, ENV_TEST, featureFlag, getSolutionPersistenceKey } from '$config';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { broadcastQueryClient } from 'react-query/broadcastQueryClient-experimental';
import { createWebStoragePersistor } from 'react-query/createWebStoragePersistor-experimental';
import { forceAuthRefreshToken } from './AmplifyProvider';
import { isAuthError, isNotFoundError, isUnauthorizedError } from '$common/utils/errors';
import { merge } from 'lodash';
import { persistQueryClient } from 'react-query/persistQueryClient-experimental';
import { solutionInfo } from '@ada/common';
import React, { PropsWithChildren, useMemo } from 'react';

const PERSIST = featureFlag('API_CACHE_PERSIST');
const BROADCAST = featureFlag('API_CACHE_BROADCAST');

type QueryClientConfig = ConstructorParameters<typeof QueryClient>[0];

const DEFAULT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // https://react-query.tanstack.com/guides/important-defaults
      // https://react-query.tanstack.com/guides/caching
      staleTime: 500,
      // https://react-query.tanstack.com/guides/query-retries
      retry: (failureCount: number, error: any) => {
        /* eslint-disable sonarjs/prefer-single-boolean-return */
        //NOSONAR (sonarjs/prefer-single-boolean-return) - won't tix
        if (failureCount >= 3) return false;
        if (isUnauthorizedError(error)) return false;
        if (isAuthError(error)) {
          forceAuthRefreshToken();
          return false;
        }
        if (isNotFoundError(error)) return false;
        return true;
        /* eslint-enable sonarjs/prefer-single-boolean-return */
      },
    },
  },
};

const TEST_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      cacheTime: Infinity,
      retry: false,
    },
  },
};

function createQueryClient(): QueryClient {
  const { id: solutionId } = solutionInfo();
  const queryClient = new QueryClient(ENV_TEST ? TEST_CONFIG : DEFAULT_CONFIG);

  // https://react-query.tanstack.com/plugins/createWebStoragePersistor
  if (PERSIST) {
    queryClient.setDefaultOptions(
      merge({}, queryClient.getDefaultOptions(), {
        queries: {
          cacheTime: 1000 * 60 * 60 * 24, // 24 hours
        },
      }),
    );

    persistQueryClient({
      queryClient,
      persistor: createWebStoragePersistor({
        key: getSolutionPersistenceKey('query.cache', true),
        storage: window.localStorage,
      }),
    });
  }

  // https://react-query.tanstack.com/plugins/broadcastQueryClient
  if (BROADCAST) {
    broadcastQueryClient({
      queryClient,
      broadcastChannel: `${solutionId}-broadcast-query`,
    });
  }

  return queryClient;
}

export const ApiProvider = ({ children }: PropsWithChildren<{}>) => {
  const queryClient = useMemo(createQueryClient, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* The rest of your application */}
      {DEBUG && <ReactQueryDevtools initialIsOpen={false} />}

      <PermissionsProvider basePermissions={BASE_PERMISSIONS}>{children}</PermissionsProvider>
    </QueryClientProvider>
  );
};

const BASE_PERMISSIONS: ApiPermissions = {
  // ensure user initially has access to fetch their permissions
  getPermissionUser: true,
};
