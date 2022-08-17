/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiTransformedOperationName } from '@ada/api/client/types';
import { ENV_STORYBOOK, ENV_TEST } from '$config';
import { isDataEqual } from '$common/utils';
import { useHistory } from 'react-router-dom';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ACCESS = 'ALLOW' | 'DENY';

export interface OperationAccess {
  access: ACCESS;
  isAllowed: boolean;
  isDenied: boolean;
}

export type ApiPermissions = Partial<{
  [P in ApiTransformedOperationName]: boolean;
}>;

export function getOperationAccess(allow: boolean): OperationAccess {
  // TODO: move this to auto mocking once adding tests - current here to prevent all other tests from failing
  if (ENV_TEST) {
    return {
      access: 'ALLOW',
      isAllowed: true,
      isDenied: false,
    };
  }

  return {
    access: allow ? 'ALLOW' : 'DENY',
    isAllowed: allow === true,
    isDenied: allow !== true,
  };
}

interface PermissionsContext {
  defaultAccess: ACCESS;
  permissions: ApiPermissions;
  applyPermissions: (permissions: ApiPermissions) => ApiPermissions;
  isAllowed: (operation: ApiTransformedOperationName) => boolean;
}

const PermissionsContext = createContext<PermissionsContext | undefined>(undefined); //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const usePermissionsContext = (): PermissionsContext => {
  const context = useContext(PermissionsContext);
  if (context == null) {
    if (ENV_TEST || ENV_STORYBOOK) {
      return TEST_CONTEXT;
    }

    throw new Error('Must wrap in PermissionsContext.Provider');
  }
  return context;
};

export const useOperationAccess = (operation: ApiTransformedOperationName): OperationAccess => {
  const { isAllowed } = usePermissionsContext();

  return useMemo<OperationAccess>(() => {
    return getOperationAccess(isAllowed(operation));
  }, [isAllowed, operation]);
};

/**
 * Indicates if every operation in list is allowed for the current user.
 * @param operations List of operation names to check
 * @returns {boolean} Returns `true` is every operation is allow, otherwise `false`
 */
export const useOperationAllowed = <T extends ApiTransformedOperationName[]>(...operations: T): boolean => {
  const { isAllowed } = usePermissionsContext();

  return operations.every((operation) => isAllowed(operation));
};

/**
 * Redirect user when operation(s) are not allowed.
 * @param redirect Path to redirect to
 * @param operations List of operations to verify are allowed
 * @returns
 */
export const useOperationDeniedRedirect = <T extends ApiTransformedOperationName[]>(
  redirect: string,
  ...operations: T
): boolean => {
  const history = useHistory();
  const allowed = useOperationAllowed(...operations);

  useEffect(() => {
    if (allowed !== true) {
      history.push(redirect);
    }
  }, [allowed, redirect]);

  return allowed;
};

const DEFAULT_ACCESS: ACCESS = ENV_TEST || ENV_STORYBOOK ? 'ALLOW' : 'DENY';

export const PermissionsProvider: React.FC<
  Partial<Pick<PermissionsContext, 'defaultAccess'>> & { basePermissions?: ApiPermissions }
> = ({ children, defaultAccess = DEFAULT_ACCESS, basePermissions }) => {
  const [permissions, setPermissions] = useState<PermissionsContext['permissions']>(basePermissions || {});

  const applyPermissions = useCallback<PermissionsContext['applyPermissions']>(
    (newPermissions) => {
      const _permissions = {
        ...newPermissions,
        ...basePermissions,
      };
      // only update permissions change if has changed
      if (!isDataEqual(permissions, _permissions)) {
        setPermissions(_permissions);
      }
      return _permissions;
    },
    [basePermissions, permissions],
  );

  const isAllowed = useCallback<PermissionsContext['isAllowed']>(
    (operation) => {
      if (operation in permissions) {
        return permissions[operation] === true;
      }

      return defaultAccess === 'ALLOW';
    },
    [permissions, defaultAccess],
  );

  const context = useMemo<PermissionsContext>(() => {
    if (ENV_TEST) return TEST_CONTEXT;

    return {
      defaultAccess,
      permissions,
      applyPermissions,
      isAllowed,
    };
  }, [defaultAccess, permissions, applyPermissions, isAllowed]);

  return <PermissionsContext.Provider value={context}>{children}</PermissionsContext.Provider>;
};

const TEST_CONTEXT: PermissionsContext = {
  defaultAccess: 'ALLOW',
  permissions: {},
  applyPermissions: (p) => p,
  isAllowed: () => true,
};
