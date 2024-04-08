/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Link, Stack, Text } from 'aws-northstar';
import { useI18nContext } from '$strings';
import React from 'react';

export const BudgetLandingPage: React.FC = () => {
  const { LL } = useI18nContext();
  return <Stack>
    <Text>
      {LL.VIEW.BUDGET.DETAILS.intro.prefix()} <Link href='https://aws.amazon.com/aws-cost-management/aws-budgets/' target='_blank'>Budget</Link> {LL.VIEW.BUDGET.DETAILS.intro.suffix()}
    </Text>
  </Stack>;
}