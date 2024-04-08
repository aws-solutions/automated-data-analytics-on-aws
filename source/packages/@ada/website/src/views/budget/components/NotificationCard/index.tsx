/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Box,
  Card,
  Container,
  KeyValuePair,
  Stack,
  StatusIndicator
} from 'aws-northstar';
import { useI18nContext } from '$strings';
import React, { useMemo } from 'react';

export const NotificationCard: React.FC<{
  budgetLimit: number,
  threshold: number,
  state?: string,
  className: string,
  subscriberList: string[],
}> = ({
  budgetLimit,
  threshold,
  state,
  subscriberList,
  className,
}) => {
  const { LL } = useI18nContext();
  const thresholdAmount = useMemo(() => {
    return Math.round(budgetLimit * threshold / 100).toFixed(2);
  }, [budgetLimit, threshold]);

  const definition = useMemo(() => {
    return LL.VIEW.BUDGET.DETAILS.NOTIFICATION.contentDefiniton(threshold, thresholdAmount, budgetLimit.toFixed(2));
  }, [thresholdAmount, threshold]);

  const status = useMemo(() => {
    if (state === 'OK') {
      return (<StatusIndicator statusType='positive'>{LL.VIEW.BUDGET.DETAILS.NOTIFICATION.statusNotExceeded()}</StatusIndicator>);
    }

    return (<StatusIndicator statusType='negative'>{LL.VIEW.BUDGET.DETAILS.NOTIFICATION.statusExceeded()}</StatusIndicator>)
  }, []);

  return (<Box className={className}>
    <Container>
      <Card title={LL.VIEW.BUDGET.DETAILS.NOTIFICATION.labelCost(threshold, thresholdAmount)}>
        <Stack>
          <KeyValuePair label={LL.VIEW.BUDGET.DETAILS.NOTIFICATION.labelDefinition()} value={definition} />
          <KeyValuePair label={LL.VIEW.BUDGET.DETAILS.NOTIFICATION.labelThreshold()} value={status} />
          <KeyValuePair label={LL.VIEW.BUDGET.DETAILS.NOTIFICATION.labelSubscribers()} value={
            <Stack spacing='none'>
              {subscriberList.map(x => `- ${x}`)}
            </Stack>
          } />
        </Stack>
      </Card>
    </Container>
  </Box>);
}
