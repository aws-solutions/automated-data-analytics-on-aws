/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessEnum, CreateAndUpdateDetails, DataProductAccessLevel, GroupEntity } from '@ada/api-client';
import { ApiTransformedOperationName } from '@ada/api/client/types';
import { DefaultGroupIds, ROOT_ADMIN_ID } from '@ada/common';
import { ENV_PRODUCTION, ENV_TEST } from '$config';
import { EntityCacheEventEmitter } from '$api';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react';
import { TEST_USER, UserProfile, federatedUserToUserProfile, isSystemEntity } from '../../common/entity/user';
import { forceAuthRefreshToken, useAmplifyContext, useTokenRefreshListener } from './AmplifyProvider';
import { usePermissionsContext } from '$api/hooks/permissions';
import { useUserPermissionsProvider } from '$api/route-permissions';
import Container from 'aws-northstar/layouts/Container';
import LoadingIndicator from 'aws-northstar/components/LoadingIndicator';

export interface UserContext {
  userProfile: UserProfile;
}

// set test user as default context for testing
const INITIAL_CONTEXT: UserContext | undefined = ENV_TEST && TEST_USER ? { userProfile: TEST_USER } : undefined;

export const UserContext = createContext<UserContext | undefined>(INITIAL_CONTEXT); //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (context == null) throw new Error('UseContextProvider not in scope');

  return context;
};

export const useUserProfile = () => {
  return useUserContext().userProfile;
};

export const useUserId = () => {
  return useUserProfile().id;
};

export const useUserDisplayName = () => {
  return useUserContext().userProfile.name;
};

export const useUserGroups = () => {
  return useUserContext().userProfile.groups;
};

export const useIsMember = (group: string) => {
  return useUserContext().userProfile.groups.includes(group);
};

export const useIsAdmin = () => {
  return useIsMember(DefaultGroupIds.ADMIN);
};

export const useIsRootAdmin = () => {
  const userId = useUserId();

  return userId === ROOT_ADMIN_ID;
};

export const useIsPowerUser = () => {
  return useIsMember(DefaultGroupIds.POWER_USER);
};

export const useIsAdminOrPowerUser = () => {
  const isAdmin = useIsAdmin();
  const isPowerUser = useIsPowerUser();

  return isAdmin || isPowerUser;
};

export const useIsDefaultUser = () => {
  return useIsMember(DefaultGroupIds.DEFAULT);
};

export const useHasNoAccess = (): boolean => {
  const isDefault = useIsDefaultUser();
  const isAdminOrPower = useIsAdminOrPowerUser();
  const noAccess = !(isDefault || isAdminOrPower);

  // If the user has no access, set interval to refresh token.
  // Without this the user can get stuck on no access state ever after access request is accepted.
  useEffect(() => {
    if (noAccess) {
      const timer = setInterval(() => {
        forceAuthRefreshToken();
      }, 5000);

      return () => clearInterval(timer);
    } else {
      return;
    }
  }, [noAccess]);

  return noAccess;
};

type TPermissions = DataProductAccessLevel;

export const useUserPolicyAccess = (permissions?: Record<string, TPermissions>): AccessEnum | null => {
  const groups = useUserGroups();
  const isAdmin = useIsAdmin();
  return useMemo(() => {
    if (isAdmin) return 'FULL';
    if (permissions == null) return null;
    return mostPrivilegedAccessFromGroups(groups, permissions);
  }, [isAdmin, groups, permissions]);
};

export function useMeetsPolicyAccess(accessLevel: AccessEnum, permissions?: Record<string, TPermissions>): boolean {
  const userPolicyAccess = useUserPolicyAccess(permissions);
  return meetsPolicyAccess(accessLevel, userPolicyAccess);
}

export function mostPrivilegedAccessFromGroups(
  groups: string[],
  permissions: Record<string, TPermissions>,
): AccessEnum | null {
  return groups.reduce((access, group) => {
    return mostPrivilegedAccess(access, permissions[group]?.access);
  }, null as AccessEnum | null);
}

export function mostPrivilegedAccess(...access: (AccessEnum | null | undefined)[]): AccessEnum | null {
  if (access.find((v) => v === 'FULL')) return 'FULL';
  if (access.find((v) => v === 'READ_ONLY')) return 'READ_ONLY';
  return null;
}

export function meetsPolicyAccess(requiredLevel: AccessEnum, level: AccessEnum | null): boolean {
  if (level == null) return false;
  if (level === 'FULL') return true;
  if (level === 'READ_ONLY') return requiredLevel === 'READ_ONLY';
  return false;
}

export function useIsOwner(entity?: CreateAndUpdateDetails): boolean | undefined {
  const userId = useUserId();
  if (entity == null) return undefined;
  return isOwner(userId, entity);
}

/**
 * Indicates if current user is allowed to modify (edit / delete) entity.
 * User must be either the "owner" or "admin" and entity must not be a "system" entity.
 * @param entity
 * @returns {boolean} Returns `true` if entity is not a "system" entity, and user is either the "owner" or "admin", otherwise returns `false`
 */
export function useUserCanModifyEntity(
  entity?: CreateAndUpdateDetails,
  options?: { operation?: ApiTransformedOperationName; allowSystem?: boolean },
): boolean {
  const { isAllowed } = usePermissionsContext();
  const _isOwner = useIsOwner(entity);
  const _isAdmin = useIsAdmin();

  // verify that user is allowed to call the operation
  if (options?.operation && isAllowed(options?.operation) !== true) return false;

  // block editing system entities, even for admins
  if (options?.allowSystem !== true && isSystemEntity(entity)) return false;

  return _isOwner || _isAdmin;
}

export function isOwner(userId: string, entity: CreateAndUpdateDetails): boolean {
  return entity.createdBy === userId;
}

const UserGate = () => (
  <Container>
    <LoadingIndicator label="Authorizing User" />
  </Container>
);

export const UserProvider = ({ children }: PropsWithChildren<{}>) => {
  const { cognitoUser } = useAmplifyContext();
  const userContext = useMemo<UserContext | undefined>(() => {
    if (cognitoUser == null) return;

    const userProfile = federatedUserToUserProfile(cognitoUser);

    if (!ENV_PRODUCTION) {
      console.log('UserProvider:cognitoUser:', cognitoUser);
      console.log('UserProvider:userProfile:', userProfile);
    }

    return {
      userProfile,
    };
  }, [cognitoUser]);

  // keep user permissions in sync
  const { refetchPermissions } = useUserPermissionsProvider(cognitoUser?.username as string);

  // Ensure downstream children only render if user already available
  if (userContext == null) {
    // gate non-DefaultUsers from see anything, show public landing page
    return <UserGate />;
  }

  return (
    <UserContext.Provider value={userContext}>
      <SessionTokenGroupClaimsSynchronizer refetchPermissions={refetchPermissions} />
      {children}
    </UserContext.Provider>
  );
};

// refresh token when user groups and group.members has discrepency
// prevents user from having to logout/login flow to get new group claims
const SessionTokenGroupClaimsSynchronizer: React.FC<{ refetchPermissions: () => void }> = ({ refetchPermissions }) => {
  const { refreshToken } = useAmplifyContext();
  const { groups: userGroups, id: userId } = useUserProfile();
  useTokenRefreshListener(refetchPermissions);

  useEffect(() => {
    const listener = async (type: string, _id: string | string[], entity: GroupEntity) => {
      if (type === 'IdentityGroup') {
        if (entity.autoAssignUsers) return; // ignore catch all groups
        try {
          // check if user groups is misaligned with group members and force refresh of token
          if (
            (!userGroups.includes(entity.groupId) && entity.members.includes(userId)) ||
            (userGroups.includes(entity.groupId) && !entity.members.includes(userId))
          ) {
            await refreshToken(true); // bypass cache to force getting new claims for groups
          }
        } catch (error: any) {
          console.warn('SessionTokenGroupClaimsSynchronizer: failed to parse group', error);
        }
      }
    };
    EntityCacheEventEmitter.on('entity.SET', listener);

    return () => {
      EntityCacheEventEmitter.off('entity.SET', listener);
    };
  }, [refreshToken, userGroups, userId]);

  return null;
};
