/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Box,
  Column,
  ColumnLayout,
  Container,
  NORTHSTAR_COLORS, ProgressBar,
  Stack,
  makeStyles,
} from 'aws-northstar';
import { BudgetDetails as Budget } from '@ada/api-client';
import { NotificationCard } from '../NotificationCard';
import { useI18nContext } from '$strings';
import React, { useMemo } from 'react';

export interface BudgetDetailsProps {
  budget: Budget;
}

const useStyles = makeStyles({
  budgetAlarmed: {
    "& div.MuiLinearProgress-root": {
      backgroundColor: NORTHSTAR_COLORS.RED,
    },
    "& span.MuiTypography-root": {
      color: NORTHSTAR_COLORS.RED,
      fontWeight: 900,
    }
  },
  budgetAmount: {
    fontSize: '48px',
  },
  notificationCard: {
    "& span.MuiCardHeader-title": {
      fontSize: '20px',
      color: NORTHSTAR_COLORS.BLUE
    }
  }
});

export const BudgetDetails: React.FC<BudgetDetailsProps> = ({ budget }) => {
  const styles = useStyles();
  const { LL } = useI18nContext();

  const actualSpend = useMemo(() => {
    return Math.round((budget.actualSpend / budget.budgetLimit) * 10000) / 100;
  }, []);

  const forecastedSpend = useMemo(() => {
    return Math.round((budget.forecastedSpend / budget.budgetLimit) * 10000) / 100;
  }, []);

  const sortedNotifications = useMemo(() => {
    return budget.softNotifications.sort((a, b) => a.threshold - b.threshold);
  }, [budget.softNotifications]);

  return (<Stack>
    <Box width='300px'>
      <Container title={LL.VIEW.BUDGET.DETAILS.budgetAmount()}>
        <Box className={styles.budgetAmount}
          padding={4}
          display='flex'
          width='100%'
          alignItems='center'
          justifyContent='center'>
          ${budget.budgetLimit}
        </Box>
      </Container>
    </Box>
    <Container title={LL.VIEW.BUDGET.DETAILS.budgetHealth()}>
      <ColumnLayout renderDivider>
        <Column>
          <Box width='100%'
            padding={2}
            paddingRight={5}
            className={actualSpend >= 100 ? styles.budgetAlarmed : undefined}
          >
            <ProgressBar
              label={LL.VIEW.BUDGET.DETAILS.actualSpend()}
              additionalInfo={LL.VIEW.BUDGET.DETAILS.spendAdditionalInfo(budget.actualSpend, budget.budgetLimit)}
              value={actualSpend}
            />
          </Box>
        </Column>
        <Column>
          <Box width='100%'
            padding={2}
            paddingRight={5}
            className={forecastedSpend >= 100 ? styles.budgetAlarmed : undefined}
          >
            <ProgressBar
              label={LL.VIEW.BUDGET.DETAILS.forecastedSpend()}
              additionalInfo={LL.VIEW.BUDGET.DETAILS.spendAdditionalInfo(budget.forecastedSpend, budget.budgetLimit)}
              value={forecastedSpend}
            />
          </Box>
        </Column>
      </ColumnLayout>
    </Container>
    <Container title={LL.VIEW.BUDGET.DETAILS.budgetNotifications()}>
      <ColumnLayout renderDivider={false}>
        {sortedNotifications.map(x => (<NotificationCard 
          key={`notification_${x.threshold || 0}`}
          threshold={x.threshold || 0}
          state={x.state}
          budgetLimit={budget.budgetLimit}
          className={styles.notificationCard}
          subscriberList={budget.subscriberList}
        />))}
      </ColumnLayout>
    </Container>
  </Stack>);
}