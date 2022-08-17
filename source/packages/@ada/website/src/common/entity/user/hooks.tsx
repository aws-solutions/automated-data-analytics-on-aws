/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { UserProfile, userEntityToUserProfile } from '.';
import { apiHooks } from '../../../api';
import { compact } from 'lodash';

export function useFederatedUsers(filter?: string) {
  const [users] = apiHooks.useAllIdentityUsers({ filter });

  return compact(users || []).map(userEntityToUserProfile);
}

export function useFederatedUser(id?: string | UserProfile): UserProfile | undefined {
  const users = useFederatedUsers();

  if (id == null) return undefined;

  if (typeof id === 'object') return id;

  return users.find((user) => user.id === id);
}
