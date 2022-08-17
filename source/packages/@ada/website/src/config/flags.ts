/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_DEVELOPMENT, ENV_PRODUCTION } from './env';
import { getSolutionPersistenceKey } from './persistence';
import { queryFlags } from './utils';

export const FLAGS = queryFlags(
  {
    // https://react-query.tanstack.com/plugins/createWebStoragePersistor
    API_CACHE_PERSIST: ENV_PRODUCTION,
    // https://react-query.tanstack.com/plugins/broadcastQueryClient
    API_CACHE_BROADCAST: ENV_PRODUCTION,
    // source/packages/@ada/website/src/api/hooks/generator.ts
    API_HOT_HOOKS: true,
    // enable pulling persistent notifications
    NOTIFICATIONS_POLLING: true,

    // Attempt to refresh token via iframe
    AUTH_REFRESH_IFRAME: false,

    // NOTE: consider limiting this feature for dev / users. Was initially used for development only,
    // but will be kept enabled based on feedback.
    API_PERMISSIONS_ENABLED: ENV_DEVELOPMENT || true,
  },
  getSolutionPersistenceKey('FEATURE_FLAGS', false),
);

export function featureFlag(flag: keyof typeof FLAGS): boolean {
  return (FLAGS[flag]) === true;
}
