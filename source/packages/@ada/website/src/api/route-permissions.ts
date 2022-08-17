/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { API_TRANSFORMED_OPERATION_KEYS, ApiTransformedOperationName } from '@ada/api/client/types';
import { ApiPermissions, usePermissionsContext } from './hooks/permissions';
import { UserPermission } from '@ada/api';
import { isEmpty, memoize } from 'lodash';
import { useCallback } from 'react';
import { useNotificationContext } from '$northstar-plus';
import apiHooks from './hooks';
import moment from 'moment';
import pluralize from 'pluralize';

const NORMALIZED_OPERATION_KEYS = API_TRANSFORMED_OPERATION_KEYS.map((key) => key.toUpperCase());

const denormalizedOperationKey = memoize((normalizedKey): ApiPermissionKey | null => {
  const index = NORMALIZED_OPERATION_KEYS.indexOf(normalizedKey);
  if (index === -1) return null;
  return API_TRANSFORMED_OPERATION_KEYS[index];
});

const getApiPermissionKeysForUserPermission = memoize((userPermission: string): ApiPermissionKey[] => {
  const normilzedUserPermission = userPermission.toUpperCase();
  const apiPermissionKeys: ApiPermissionKey[] = [];
  if (normilzedUserPermission.startsWith('GET')) {
    // permissions does not support "List" so need to marshall for both Get/List cases
    const base = normilzedUserPermission.replace('GET', '');
    const listVariant = String('LIST' + pluralize.plural(base)).toUpperCase();
    const listOperation = denormalizedOperationKey(listVariant);
    if (listOperation) {
      apiPermissionKeys.push(listOperation);
    }
  }
  const operationKey = denormalizedOperationKey(normilzedUserPermission);
  if (operationKey) {
    apiPermissionKeys.push(operationKey);
  }

  if (isEmpty(apiPermissionKeys)) {
    console.info(
      `Found non-matching user permission to api permission - attempting to marshall`,
      userPermission,
      normilzedUserPermission,
    );

    // Attempt to marshall non explicit matched routes
    if (userPermission === 'GetQueryResultAsAthena') {
      return ['listQueryResultsAsAthenaResults'];
    }

    console.error('User permission is not mappable to api permission:', userPermission, API_TRANSFORMED_OPERATION_KEYS);
    throw new Error(`Failed to marshal user permission to api permission: ${userPermission}`);
  }

  return apiPermissionKeys;
});

export const useUserPermissionsProvider = (currentCognitoUsername: string, options?: { refetchInterval?: number }) => {
  const { addFatal } = useNotificationContext();
  const { applyPermissions } = usePermissionsContext();
  const [, { refetch }] = apiHooks.usePermissionUser(
    { userId: currentCognitoUsername },
    {
      onError: (error) => {
        addFatal({
          header: 'Failed to get user permissions',
          content: error.message,
        });
      },
      onSuccess: (result) => {
        // keep api hooks in sync with permissions
        applyPermissions(userPermissionsToApiPermissions(result?.permissions));
      },
      cacheTime: moment.duration(1, 'week').asMilliseconds(),
      refetchInterval: options?.refetchInterval || moment.duration(5, 'minute').asMilliseconds(),
    },
  );

  const refetchPermissions = useCallback(() => {
    refetch({ force: true });
  }, [refetch]);

  return { refetchPermissions };
};

export function userPermissionsToApiPermissions(userPermissions?: UserPermission): ApiPermissions {
  const permissions = Object.fromEntries(
    Object.entries(userPermissions || {}).flatMap(([key, value]) => {
      return routeToApiPermission(key, value.access === true);
    }),
  ) as ApiPermissions;
  console.debug('UserPermissions => ApiPermissions:', userPermissions, permissions);

  // verify that all operations are mapped
  const unmappedOperations: ApiTransformedOperationName[] = API_TRANSFORMED_OPERATION_KEYS.filter(
    (key) => key in permissions !== true,
  );
  unmappedOperations.forEach((unmappedOperation) => {
    switch (unmappedOperation) {
      case 'listQueryNamespaceSavedQueries': {
        permissions.listQueryNamespaceSavedQueries = permissions.listQuerySavedQueries;
        break;
      }
      case 'putIdentityRequestAction': {
        permissions.putIdentityRequestAction = permissions.putIdentityRequest;
        break;
      }
      default: {
        console.warn(`Missing permission for api operation "${unmappedOperation}"`, permissions);
      }
    }
  });

  return permissions;
}

type ApiPermissionKey = keyof ApiPermissions;
type ApiPermissionTuple = [ApiPermissionKey, boolean];

function routeToApiPermission(route: string, access: boolean): ApiPermissionTuple[] {
  const perimissionKeys = getApiPermissionKeysForUserPermission(route);

  return perimissionKeys.map((key) => [key, access]);
}
