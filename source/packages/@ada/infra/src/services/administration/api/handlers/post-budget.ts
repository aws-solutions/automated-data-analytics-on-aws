/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { BUDGET_COST_FILTER, BUDGET_CURRENCY, 
  NOTIFICATION_COMPARISON_OPERATOR, 
  NOTIFICATION_STATE, 
  NOTIFICATION_THRESHOLD_TYPE, 
  NOTIFICATION_TYPE, 
  SUBSCRIPTION_TYPE,
  getBudgetName } from '../../constant';
import {
  Budget, 
  BudgetsClient,
  CreateBudgetCommand, 
  CreateBudgetCommandInput,
  CreateNotificationCommand, 
  CreateNotificationCommandInput,
  CreateSubscriberCommand, 
  CreateSubscriberCommandInput,
  DeleteNotificationCommand, 
  DeleteNotificationCommandInput,
  DeleteSubscriberCommand, 
  DeleteSubscriberCommandInput,
  UpdateBudgetCommand, 
  UpdateBudgetCommandInput
} from '@aws-sdk/client-budgets';
import { BudgetInput } from '@ada/api-client';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { difference, flatten, intersection, isEqual } from 'lodash';
import { getBudget, getBudgetNotificationSubscribers } from './get-budget';

const REGION = process.env.AWS_REGION || '';
const BUDGET_NAME = getBudgetName(REGION);

/**
 * Handler for creating/updating a Budget
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'postAdministrationBudgets',
  async ({ body: budget }, _callingUser, event, { log }) => {
    try {
      const client = new BudgetsClient({ region: process.env.AWS_REGION });
      const accountId = event.requestContext.accountId;

      const oldBudget = await getBudget(client, accountId, log);

      if (oldBudget) {
        await updateBudget(client, accountId, log, budget, oldBudget);

        return ApiResponse.success({
          budgetName: BUDGET_NAME,
          message: 'Budget updated successfully',
        });
      }

      await createBudget(client, accountId, log, budget);
      return ApiResponse.success({
        budgetName: BUDGET_NAME,
        message: 'Budget created successfully',
      });
    } catch (e: any) {
      log.error('Create/Update budget failed', e);
      return ApiResponse.badRequest({
        message: 'Error in postBudget'
      });
    }
  },
);

const getNotifications = (budget: BudgetInput) => {
  const notifications: CreateBudgetCommandInput['NotificationsWithSubscribers'] = [];
  const subscribers: { SubscriptionType: string; Address: any; }[] = [];

  budget.subscriberList.forEach((item: any) => {
    const subscriber = {
      SubscriptionType: SUBSCRIPTION_TYPE,
      Address: item,
    };
    subscribers.push(subscriber);
  });

  budget.softNotifications.forEach((item: number) => {
    const notification = {
      // NotificationWithSubscribers
      Notification: {
        // Notification
        NotificationType: NOTIFICATION_TYPE,
        ComparisonOperator: NOTIFICATION_COMPARISON_OPERATOR,
        ThresholdType: NOTIFICATION_THRESHOLD_TYPE,
        NotificationState: NOTIFICATION_STATE,
        Threshold: Number(item),
      },
      Subscribers: subscribers,
    };

    notifications.push(notification);
  });

  return notifications;
}

const createBudget = async (client: BudgetsClient, accountId: string, log: Logger, budget: BudgetInput) => {
  const notifications = getNotifications(budget);

  const input: CreateBudgetCommandInput = {
    AccountId: accountId,
    Budget: {
      // Budget
      BudgetName: BUDGET_NAME,
      BudgetLimit: {
        // Spend
        Amount: String(budget.budgetLimit),
        Unit: BUDGET_CURRENCY,
      },
      CostFilters: {
        // CostFilters
        TagKeyValue: [
          // DimensionValues
          BUDGET_COST_FILTER,
        ],
      },
      TimeUnit: 'MONTHLY',
      BudgetType: 'COST',
    },
    NotificationsWithSubscribers: notifications,
  };

  log.info('CreateBudgetCommand input', input);
  const command = new CreateBudgetCommand(input);
  const response = await client.send(command);
  log.info('CreateBudgetCommand output', response);

  return response;
}

const updateBudget = async (
  client: BudgetsClient,
  accountId: string,
  log: Logger,
  budget: BudgetInput,
  _oldBudget: Budget) => {
  // Handle Subscribers change
  const input: UpdateBudgetCommandInput = {
    AccountId: accountId,
    NewBudget: {
      // Budget
      BudgetName: BUDGET_NAME,
      BudgetLimit: {
        // Spend
        Amount: String(budget.budgetLimit),
        Unit: BUDGET_CURRENCY,
      },
      CostFilters: {
        // CostFilters
        TagKeyValue: [
          // DimensionValues
          BUDGET_COST_FILTER,
        ],
      },
      TimeUnit: 'MONTHLY',
      BudgetType: 'COST',
    },
  };

  log.info('UpdateBudgetCommand input', input);
  const command = new UpdateBudgetCommand(input);
  const response = await client.send(command);
  log.info('UpdateBudgetCommand output', response);

  await updateBudgetNotificationSubscribers(client, accountId, log, budget);

  return response;
}

const updateBudgetNotificationSubscribers = async (client: BudgetsClient, 
  accountId: string, 
  log: Logger, 
  budget: BudgetInput) => {
  const { softNotifications: oldDetailedSoftNotifications, 
    subscriberList: oldSubscriberList } = await getBudgetNotificationSubscribers(client, accountId, log);
  const { softNotifications, subscriberList } = budget;

  const oldSoftNotifications = oldDetailedSoftNotifications.map(x => x.threshold);

  if (!isEqual(oldSoftNotifications, softNotifications) || !isEqual(oldSubscriberList, subscriberList)) {
    log.info('Updating Notifications and its Subscribers');

    const notificationsToBeDeleted = difference(oldSoftNotifications, softNotifications);
    if (notificationsToBeDeleted.length > 0) {
      log.info('notificationsToBeDeleted:', notificationsToBeDeleted);
      const promises = notificationsToBeDeleted.map(x => {
        return deleteNotification(client, accountId, log, x);
      })

      const notificationsToBeDeletedOutput = await Promise.all(promises);
      log.info('Notifications deleted', notificationsToBeDeletedOutput);
    }

    const notificationsToBeAdded = difference(softNotifications, oldSoftNotifications);
    if(notificationsToBeAdded.length > 0) {
      log.info('notificationsToBeAdded:', notificationsToBeAdded)
      const promises = notificationsToBeAdded.map(x => {
        return createNotification(client, accountId, log, x, subscriberList);
      })

      const notificationsToBeAddedOutput = await Promise.all(promises);
      log.info('Notifications added:', notificationsToBeAddedOutput);
    }

    const notificationsRemain = intersection(softNotifications, oldSoftNotifications);
    if(notificationsRemain.length > 0 && !isEqual(oldSubscriberList, subscriberList)) {
      log.info('notificationsRemain', notificationsRemain)
      const subscribersToBeAdded = difference(subscriberList, oldSubscriberList);
      if(subscribersToBeAdded.length > 0) {
        log.info('subscribersToBeAdded', subscribersToBeAdded);
        const promises = flatten(notificationsRemain.map(n => subscribersToBeAdded.map(s => {
          return createSubscriber(client, accountId, log, n, s);
        })));
  
        const subscribersToBeAddedOutput = await Promise.all(promises);
        log.info('Subscribers added:', subscribersToBeAddedOutput);
      }

      const subscribersToBeDeleted = difference(oldSubscriberList, subscriberList);
      if(subscribersToBeDeleted.length > 0) {
        log.info(`subscribersToBeDeleted: ${subscribersToBeDeleted}`);
        const promises = flatten(notificationsRemain.map(n => subscribersToBeDeleted.map(s => {
          return deleteSubscriber(client, accountId, log, n, s);
        })));
  
        const subscribersToBeDeletedOutput = await Promise.all(promises);
        log.info(`Subscribers deleted: ${subscribersToBeDeletedOutput}`);
      }
    }
  }
  else {
    log.info('Notifications and its Subscribers unchanged');
  }
}

const deleteNotification = async (client: BudgetsClient, 
  accountId: string, 
  log: Logger, 
  threshold: number) => {
  const input: DeleteNotificationCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
    Notification: {
      NotificationType: NOTIFICATION_TYPE,
      ComparisonOperator: NOTIFICATION_COMPARISON_OPERATOR,
      ThresholdType: NOTIFICATION_THRESHOLD_TYPE,
      NotificationState: NOTIFICATION_STATE,
      Threshold: threshold,
    }
  }

  log.info('DeleteNotificationCommand input', input);
  const output = await client.send(new DeleteNotificationCommand(input));
  log.info('DeleteNotificationCommand output', output);

  return output;
}

const createNotification = async (client: BudgetsClient, 
  accountId: string, 
  log: Logger, 
  threshold: number, 
  subscriberList: string[]) => {
  const input: CreateNotificationCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
    Notification: {
      NotificationType: NOTIFICATION_TYPE,
      ComparisonOperator: NOTIFICATION_COMPARISON_OPERATOR,
      ThresholdType: NOTIFICATION_THRESHOLD_TYPE,
      NotificationState: NOTIFICATION_STATE,
      Threshold: threshold,
    },
    Subscribers: subscriberList.map(x => ({
      SubscriptionType: SUBSCRIPTION_TYPE,
      Address: x,
    }))
  };

  log.info('CreateNotificationCommand input', input);
  const output = await client.send(new CreateNotificationCommand(input));
  log.info('CreateNotificationCommand output', output);

  return output;
}

const deleteSubscriber = async (client: BudgetsClient, 
  accountId: string, 
  log: Logger, 
  threshold: number, 
  subscriber: string) => {
  const input: DeleteSubscriberCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
    Notification: {
      NotificationType: NOTIFICATION_TYPE,
      ComparisonOperator: NOTIFICATION_COMPARISON_OPERATOR,
      ThresholdType: NOTIFICATION_THRESHOLD_TYPE,
      NotificationState: NOTIFICATION_STATE,
      Threshold: threshold,
    },
    Subscriber: {
      Address: subscriber,
      SubscriptionType: SUBSCRIPTION_TYPE,
    }
  }

  log.info('DeleteSubscriberCommand input', input);
  const output = await client.send(new DeleteSubscriberCommand(input));
  log.info('DeleteSubscriberCommand output', output);

  return output;
}

const createSubscriber = async (client: BudgetsClient, 
  accountId: string, 
  log: Logger, 
  threshold: number, 
  subscriber: string) => {
  const input: CreateSubscriberCommandInput = {
    AccountId: accountId,
    BudgetName: BUDGET_NAME,
    Notification: {
      NotificationType: NOTIFICATION_TYPE,
      ComparisonOperator: NOTIFICATION_COMPARISON_OPERATOR,
      ThresholdType: NOTIFICATION_THRESHOLD_TYPE,
      NotificationState: NOTIFICATION_STATE,
      Threshold: threshold,
    },
    Subscriber: {
      Address: subscriber,
      SubscriptionType: SUBSCRIPTION_TYPE,
    }
  }

  log.info('CreateSubscriberCommand input', input);
  const output = await client.send(new CreateSubscriberCommand(input));
  log.info('CreateSubscriberCommand output', output);

  return output;
}
