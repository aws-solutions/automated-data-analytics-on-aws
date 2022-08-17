/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser, DataProductAccess, DefaultGroupIds } from '@ada/common';
import { DataProductPolicyEntity } from '@ada/api';
import {
  isPermittedByDataProductPolicy,
  isPermittedForFullAccessByDataProductPolicy,
  isPermittedForReadAccessByDataProductPolicy,
} from '../permissions';

export const ADMIN_CALLER: CallingUser = {
  userId: 'test-user',
  groups: ['admin', 'analyst'],
  username: 'test-user@example.com',
};

export const POWER_CALLER: CallingUser = {
  userId: 'power-user',
  groups: ['power-user', 'analyst'],
  username: 'test-default@example.com',
};

export const DEFAULT_CALLER: CallingUser = {
  userId: 'test-user',
  groups: ['default', 'analyst'],
  username: 'test-default@example.com',
};

export const dataProductIdentifier = {
  dataProductId: 'dataproduct-123',
  domainId: 'domain1',
};

describe('permissions', () => {
  it('should check permissions for full access', () => {
    const policy: DataProductPolicyEntity = {
      ...dataProductIdentifier,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        'power-user': {
          access: DataProductAccess.FULL,
        },
        default: {
          access: DataProductAccess.READ_ONLY,
        },
        analyst: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    };

    expect(isPermittedForFullAccessByDataProductPolicy(policy, ADMIN_CALLER)).toEqual(true);
    expect(isPermittedForFullAccessByDataProductPolicy(policy, POWER_CALLER)).toEqual(true);
    expect(isPermittedForFullAccessByDataProductPolicy(policy, DEFAULT_CALLER)).toEqual(false);
  });

  it('should check permissions for read access', () => {
    const policy: DataProductPolicyEntity = {
      ...dataProductIdentifier,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        'power-user': {
          access: DataProductAccess.FULL,
        },
        default: {
          access: DataProductAccess.READ_ONLY,
        },
        analyst: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    };

    expect(isPermittedForReadAccessByDataProductPolicy(policy, ADMIN_CALLER)).toEqual(true);
    expect(isPermittedForReadAccessByDataProductPolicy(policy, POWER_CALLER)).toEqual(true);
    expect(isPermittedForReadAccessByDataProductPolicy(policy, DEFAULT_CALLER)).toEqual(true);
  });

  describe('isPermittedByDataProductPolicy', () => {
    const allowedAccessLevels = [DataProductAccess.FULL];

    const permissions: DataProductPolicyEntity = {
      ...dataProductIdentifier,
      createdBy: 'owner',
      permissions: {
        marketing: {
          access: DataProductAccess.FULL,
        },
        analyst: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    };

    const userWithGroups = (groups: string[]): CallingUser => ({
      userId: 'test-user',
      username: 'test@example.com',
      groups,
    });

    it('should return false if no groups are provided', async () => {
      const groups = [''];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(false);
    });

    it('should return false if groups is an empty list', async () => {
      const groups: string[] = [];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(false);
    });

    it('should return false if none of the groups provided is allowed', async () => {
      const groups = ['nomatch', 'random', 'none'];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(false);
    });

    it('should return true if one of the groups is allowed', async () => {
      const groups = ['marketing', 'nomatch'];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(true);
    });

    it('should return true if more than one of the groups is allowed', async () => {
      const groups = ['marketing', 'analyst', 'nomatch'];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(true);
    });

    it('should return true if the user is an admin, regardless of the admin permissions', async () => {
      const groups = [DefaultGroupIds.ADMIN, 'nomatch'];
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, userWithGroups(groups));
      expect(allowed).toBe(true);
    });

    it('should return true if the user is the owner of the policy, regardless of the admin permissions', async () => {
      const allowed = isPermittedByDataProductPolicy(permissions, allowedAccessLevels, {
        userId: 'owner',
        username: 'test@example.com',
        groups: [],
      });
      expect(allowed).toBe(true);
    });

    const restrictivePermissions: DataProductPolicyEntity = {
      ...dataProductIdentifier,
      permissions: {
        marketing: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    };

    it('should return false with restrictive permissions', async () => {
      const groups = ['something', 'marketing'];
      const allowed = isPermittedByDataProductPolicy(
        restrictivePermissions,
        allowedAccessLevels,
        userWithGroups(groups),
      );
      expect(allowed).toBe(false);
    });
  });
});
