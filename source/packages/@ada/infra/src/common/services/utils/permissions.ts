/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser, DataProductAccess, DefaultGroupIds } from '@ada/common';
import { DataProductPolicyEntity } from '@ada/api';
import pick from 'lodash/pick';

export const isPermittedByDataProductPolicy = (
  policy: DataProductPolicyEntity,
  allowedAccessLevels: DataProductAccess[],
  { userId, groups }: CallingUser,
) => {
  // Check that the user is already in a group with the appropriate permissions
  const allowedAccessLevelsSet = new Set(allowedAccessLevels);
  const hasAccessByPolicy = Object.values(pick(policy.permissions, groups)).some((permission) =>
    allowedAccessLevelsSet.has(permission.access as DataProductAccess),
  );

  // As an escape-hatch against a user locking everyone out, the original creator and admin are always allowed
  const isOriginalCreator = policy.createdBy === userId;
  return hasAccessByPolicy || isOriginalCreator || groups.includes(DefaultGroupIds.ADMIN);
};

export const isPermittedForFullAccessByDataProductPolicy = (
  policy: DataProductPolicyEntity,
  callingUser: CallingUser,
): boolean => isPermittedByDataProductPolicy(policy, [DataProductAccess.FULL], callingUser);

export const isPermittedForReadAccessByDataProductPolicy = (
  policy: DataProductPolicyEntity,
  callingUser: CallingUser,
): boolean =>
  isPermittedByDataProductPolicy(policy, [DataProductAccess.FULL, DataProductAccess.READ_ONLY], callingUser);
