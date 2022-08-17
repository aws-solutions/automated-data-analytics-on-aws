/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicy } from '@ada/api';
import { DefaultApiAccessPolicyIds } from '@ada/common';
import { sortApiAccessPolicies } from './index';

describe('common/entity/api-access-policy', () => {
  describe('sortApiAccessPolicies', () => {
    it('should correctly sort api policies', () => {
      const policies: Partial<ApiAccessPolicy>[] = [
        { apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_GOVERNANCE },
        { apiAccessPolicyId: DefaultApiAccessPolicyIds.ADMINISTRATOR_ACCESS },
        { apiAccessPolicyId: 'custom-b' },
        { apiAccessPolicyId: DefaultApiAccessPolicyIds.DEFAULT },
        { apiAccessPolicyId: 'custom-a' },
        { apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_DATA_PRODUCTS },
      ];
      expect(sortApiAccessPolicies(policies as ApiAccessPolicy[]).map((policy) => policy.apiAccessPolicyId)).toEqual([
        DefaultApiAccessPolicyIds.DEFAULT,
        DefaultApiAccessPolicyIds.MANAGE_DATA_PRODUCTS,
        DefaultApiAccessPolicyIds.MANAGE_GOVERNANCE,
        DefaultApiAccessPolicyIds.ADMINISTRATOR_ACCESS,
        'custom-a',
        'custom-b',
      ]);
    });
  });
});
