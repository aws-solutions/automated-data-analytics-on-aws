/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicyEntity } from '@ada/api';
import { DefaultApiAccessPolicyIds } from '@ada/common';
import { SYSTEM_USER } from '$common/entity/user';
import { startCase } from 'lodash';

export const API_ACCESS_POLICIES: ApiAccessPolicyEntity[] = Object.values(DefaultApiAccessPolicyIds).map((id) => {
  return {
    apiAccessPolicyId: id,
    name: startCase(id),
    description: `Mock policy for ${id}`,
    resources: [],
    createdBy: SYSTEM_USER,
  };
});
