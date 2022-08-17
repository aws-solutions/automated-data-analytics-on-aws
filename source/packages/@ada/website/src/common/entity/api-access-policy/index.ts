/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicy } from '@ada/api';
import { DefaultApiAccessPolicyIds } from '@ada/common';

const DEFAULT_IDS = Object.values(DefaultApiAccessPolicyIds);

export function sortApiAccessPolicyIds(policies: string[]): string[] {
  return policies.sort((a, b) => {
    const aIndex = DEFAULT_IDS.indexOf(a as DefaultApiAccessPolicyIds);
    const bIndex = DEFAULT_IDS.indexOf(b as DefaultApiAccessPolicyIds);
    // sort based on enum definition order for default policies
    if (aIndex > -1 && bIndex > -1) {
      return aIndex < bIndex ? -1 : 1;
    }
    if (aIndex > -1 || bIndex > -1) {
      // sort default policy before custom policy
      return aIndex > -1 ? -1 : 1;
    }
    // sort alphabetically for custom access policies based on id
    return a < b ? -1 : 1;
  });
}

export function sortApiAccessPolicies(policies: ApiAccessPolicy[]): ApiAccessPolicy[] {
  const sortedIds = sortApiAccessPolicyIds(policies.map((policy) => policy.apiAccessPolicyId));

  return sortedIds.map((id) => policies.find((policy) => policy.apiAccessPolicyId === id)) as ApiAccessPolicy[];
}
