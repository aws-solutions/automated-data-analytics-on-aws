/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  NotFoundException,
} from '@aws-sdk/client-budgets';

export const BUDGET_NAME = 'AWS_Solution_Ada_ap-southeast-1';
export const ACCOUNT_ID = '11111111111';

export const NOT_FOUND_ERROR = new NotFoundException({
  message: 'Budget not found',
  $metadata: {},
});

export const BUDGET_OUTPUT = {
  Budget: {
    BudgetName: BUDGET_NAME,
    BudgetType: 'COST',
    TimeUnit: 'MONTHLY',
    BudgetLimit: {
      Amount: "300.00",
      Unit: 'USD',
    },
    CalculatedSpend: {
      ActualSpend: {
        Amount: "120.00",
        Unit: 'USD',
      },
      ForecastedSpend: {
        Amount: "1000.00",
        Unit: 'USD',
      }
    }
  }
}

export const BUDGET_NOTIFICATIONS_OUTPUT = {
  Notifications: [
    {
      ComparisonOperator: 'GREATER_THAN',
      NotificationState: 'OK',
      NotificationType: 'ACTUAL',
      Threshold: 100
    },
    {
      ComparisonOperator: 'GREATER_THAN',
      NotificationState: 'ALARM',
      NotificationType: 'ACTUAL',
      Threshold: 30
    },
    {
      ComparisonOperator: 'GREATER_THAN',
      NotificationState: 'ALARM',
      NotificationType: 'ACTUAL',
      Threshold: 60
    }
  ]
}

export const BUDGET_NOTIFICATIONS_EMPTY = {
}

export const BUDGET_SUBSCRIBERS_OUTPUT = {
  "Subscribers": [
    {
      Address: "test@example.com",
      SubscriptionType: "EMAIL"
    },
    {
      Address: "test@domain.example.com",
      SubscriptionType: "EMAIL",
    }
  ]
}

export const EXPECTED_GET_BUDGET_OUTPUT = {
  budgetLimit: 300,
  actualSpend: 120,
  forecastedSpend: 1000,
  softNotifications: [ 
    {
      state: "ALARM", 
      threshold: 30
    }, 
    {
      state: "ALARM", 
      threshold: 60
    },
    {
      state: "OK", 
      threshold: 100
    },
  ],
  subscriberList: ['test@example.com', 'test@domain.example.com']
}

export const BUDGET_INPUT = {
  budgetLimit: 400,
  subscriberList: ['test@example.com', 'test1@domain.example.com'],
  softNotifications: [40, 80, 100],
}

export const BUDGET_INPUT_ONLY_BUDGET_LIMIT_CHANGE = {
  budgetLimit: 400,
  subscriberList: ['test@example.com', 'test@domain.example.com'],
  softNotifications: [30, 60, 100],
}