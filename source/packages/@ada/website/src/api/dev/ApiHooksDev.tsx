/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { apiHooks, useApiInvalidation } from '$api/hooks';
import Button from 'aws-northstar/components/Button';
import Container from 'aws-northstar/layouts/Container';
import React from 'react';

const { useLazyAllApiAccessPolicies, useWaitForApiAccessPolicy } = apiHooks;

export interface CreateGroupContainerProps {}

export const ApiHookDev = () => {
  const [fetchAllApiAccessPolicies, apiAccessPolicies, useLazyAllApiAccessPoliciesInfo] = useLazyAllApiAccessPolicies();
  const invalidation = useApiInvalidation();
  const [waitForAdminApiAccessPolicy, waitForValue, waitForInfo] = useWaitForApiAccessPolicy(
    { apiAccessPolicyId: 'not-valid-value' },
    { waitForTimeout: 5000 },
  );

  return (
    <>
      <Container headingVariant="h2" title="ApiAccessPolicies">
        <Container headingVariant="h4" title="Fetch All ApiAccessPolicies">
          <Button onClick={() => fetchAllApiAccessPolicies()}>fetchAllApiAccessPolicies</Button>
          <pre>{JSON.stringify(apiAccessPolicies, null, 2)}</pre>
        </Container>
        <Container headingVariant="h4" title="Invalidate All ApiAccessPolicies">
          <Button onClick={() => useLazyAllApiAccessPoliciesInfo.invalidate()}>Invalidate</Button>
        </Container>
        <Container headingVariant="h4" title="Force Refetch All ApiAccessPolicies">
          <Button onClick={() => useLazyAllApiAccessPoliciesInfo.refetch({ force: true })}>Force Refetch</Button>
        </Container>
        <Container headingVariant="h4" title="Nondirect Invalidat All ApiAccessPolicies">
          <Button onClick={() => invalidation.invalidateEntityLists('ApiAccessPolicy')}>Invalidate</Button>
        </Container>
        <Container headingVariant="h4" title="Wait For">
          <Button onClick={() => waitForAdminApiAccessPolicy()}>Start Wait For</Button>
          {!waitForInfo.isIdle && <pre>waitForValue: {JSON.stringify(waitForValue, null, 2)}</pre>}
          {!waitForInfo.isIdle && <pre>waitForInfo: {JSON.stringify(waitForInfo, null, 2)}</pre>}
        </Container>
      </Container>
    </>
  );
};
