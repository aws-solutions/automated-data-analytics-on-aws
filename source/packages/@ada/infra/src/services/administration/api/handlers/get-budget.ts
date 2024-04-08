/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import {
  BudgetsClient,
  DescribeBudgetCommand,
  DescribeBudgetCommandInput,
  DescribeNotificationsForBudgetCommand,
  DescribeNotificationsForBudgetCommandInput,
  DescribeSubscribersForNotificationCommand,
  DescribeSubscribersForNotificationCommandInput,
  NotFoundException,
} from '@aws-sdk/client-budgets';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import {
  SUBSCRIPTION_TYPE,
  getBudgetName,
} from '../../constant';

const REGION = process.env.AWS_REGION || '';
const BUDGET_NAME = getBudgetName(REGION);

export interface Notification {
  threshold: number;
  state: string;
}

/**
 * Handler for retrieving budget details
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getAdministrationBudgets',
  async (_request, _callingUser, event, { log }) => {
    try {
      const client = new BudgetsClient({ region: process.env.AWS_REGION });
      const accountId = event.requestContext.accountId;
      const budget = await getBudget(client, accountId, log);

      if (budget) {
        const { softNotifications, subscriberList } = await getBudgetNotificationSubscribers(client, accountId, log);

        const budgetOutput = {
          budgetLimit: Number(budget.BudgetLimit?.Amount || 0),
          actualSpend: Number(budget.CalculatedSpend?.ActualSpend?.Amount || 0),
          forecastedSpend: Number(budget.CalculatedSpend?.ForecastedSpend?.Amount || 0),
          softNotifications: softNotifications,
          subscriberList: subscriberList,
        }

        return ApiResponse.success(budgetOutput);
      }

      return ApiResponse.notFound({
        message: 'Budget not found'
      });
    } catch (e: any) {
      log.error('getBudget error', e);
      return ApiResponse.badRequest({
        message: 'Error in getBudget'
      });
    }
  },
);

export const getBudget = async (client: BudgetsClient, accountId: string, log: Logger) => {
  try {
    const input: DescribeBudgetCommandInput = {
      AccountId: accountId,
      BudgetName: BUDGET_NAME,
    }

    log.info('DescribeBudgetCommand input', input);
    const output = await client.send(new DescribeBudgetCommand(input));
    log.info('DescribeBudgetCommand output', output);
    return output.Budget;
  } catch (e: any) {
    if (e instanceof NotFoundException) {
      return null;
    }

    throw e;
  }
}

const describeSubscribersForNotification = async (client: BudgetsClient, accountId: string, log: Logger, notification: DescribeSubscribersForNotificationCommandInput['Notification']) => {
  const input: DescribeSubscribersForNotificationCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
    Notification: notification,
  }

  log.info('DescribeSubscribersForNotificationCommand input', input);
  const output = client.send(new DescribeSubscribersForNotificationCommand(input));
  log.info('DescribeSubscribersForNotificationCommand output', output);

  return output;
}

export const getBudgetNotificationSubscribers = async (client: BudgetsClient, accountId: string, log: Logger) => {
  const input: DescribeNotificationsForBudgetCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
  }

  log.info('DescribeNotificationsForBudgetCommand input', input);
  const output = await client.send(new DescribeNotificationsForBudgetCommand(input));
  log.info('DescribeNotificationsForBudgetCommand output', output);

  if (output.Notifications && output.Notifications.length > 0) {
    const promises = output.Notifications.filter(x => x.ComparisonOperator === 'GREATER_THAN'
      && x.NotificationType === 'ACTUAL'
    ).map((x) => {
      return describeSubscribersForNotification(client, accountId, log, x);
    });

    const subscribersOutput = await Promise.all(promises);

    const subscriberList: string[] = [];

    subscribersOutput.forEach(x => {
      if (x.Subscribers) {
        x.Subscribers.forEach(s => {
          if (s.SubscriptionType === SUBSCRIPTION_TYPE && s.Address && !subscriberList.includes(s.Address)) {
            subscriberList.push(s.Address);
          }
        })
      }
    })

    return {
      softNotifications: output.Notifications.map(x => ({
        threshold: x.Threshold || 0,
        state: x.NotificationState || ''
      })).filter(x => x.threshold > 0).sort((a, b) => a.threshold - b.threshold) as Notification[],
      subscriberList,
    }
  }

  return {
    softNotifications: [],
    subscriberList: [],
  };
}
