/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyStore } from '../../components/ddb/api-access-policy';
import { GroupStore } from '../../components/ddb/groups';

export const getResourcePoliciesFromGroups = async (groups: string[]) => {
  const groupList = await GroupStore.getInstance().batchGetGroups(groups);
  const accessPolicyList = Object.entries(groupList).flatMap(([_, value]) => value.apiAccessPolicyIds);

  const accessPolicies = await ApiAccessPolicyStore.getInstance().batchGetApiAccessPolicies(accessPolicyList);

  return Object.entries(accessPolicies).flatMap(([_, value]) => value.resources);
};
