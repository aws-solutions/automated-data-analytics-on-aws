/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { mockClient } from 'aws-sdk-client-mock';
import {
  BudgetsClient,
  CreateBudgetCommand,
  CreateNotificationCommand,
  CreateSubscriberCommand,
  DescribeBudgetCommand,
  DescribeNotificationsForBudgetCommand,
  DescribeSubscribersForNotificationCommand,
  UpdateBudgetCommand,
  DeleteNotificationCommand,
  DeleteSubscriberCommand,
} from '@aws-sdk/client-budgets';
import { apiGatewayEvent } from '@ada/microservice-test-common';
import { handler } from '../post-budget';
import {
  ACCOUNT_ID,
  BUDGET_NAME,
  BUDGET_INPUT,
  BUDGET_INPUT_ONLY_BUDGET_LIMIT_CHANGE,
  BUDGET_OUTPUT,
  BUDGET_NOTIFICATIONS_OUTPUT,
  BUDGET_SUBSCRIBERS_OUTPUT,
  NOT_FOUND_ERROR,
} from '../__fixtures__/budget';
import { BUDGET_COST_FILTER, BUDGET_CURRENCY } from '../../../constant';

const mockBudgetsClient = mockClient(BudgetsClient);

describe('post-budget', () => {
  beforeEach(() => {
    mockBudgetsClient.reset();
  });

  it('should invoke the post-budget lambda and create the budget if budget not found', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).rejects(NOT_FOUND_ERROR);
    mockBudgetsClient.on(CreateBudgetCommand).resolves({});
    const response = await callHandler();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        budgetName: BUDGET_NAME,
        message: 'Budget created successfully'
      }),
    );
  });

  it('should update the budget if budget exists', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    mockBudgetsClient.on(UpdateBudgetCommand).resolves({});
    mockBudgetsClient.on(CreateNotificationCommand).resolves({});
    mockBudgetsClient.on(CreateSubscriberCommand).resolves({});
    mockBudgetsClient.on(DeleteNotificationCommand).resolves({});
    mockBudgetsClient.on(DeleteSubscriberCommand).resolves({});
    const response = await callHandler();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        budgetName: BUDGET_NAME,
        message: 'Budget updated successfully'
      }),
    );

    expect(mockBudgetsClient).toHaveReceivedCommandWith(UpdateBudgetCommand, {
      AccountId: ACCOUNT_ID,
      NewBudget: {
        // Budget
        BudgetName: BUDGET_NAME,
        BudgetLimit: {
          // Spend
          Amount: String(BUDGET_INPUT.budgetLimit),
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
      }
    });

    expect(mockBudgetsClient).toHaveReceivedCommandTimes(CreateNotificationCommand, 2);
    expect(mockBudgetsClient).toHaveReceivedCommandTimes(DeleteNotificationCommand, 2);

    expect(mockBudgetsClient).toHaveReceivedCommandTimes(CreateSubscriberCommand, 1);
    expect(mockBudgetsClient).toHaveReceivedCommandTimes(DeleteSubscriberCommand, 1);
  });

  it('should update the budget without updating notifications if budget exists and budget notifications and subscribers unchanged', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    mockBudgetsClient.on(UpdateBudgetCommand).resolves({});
    const response = await callHandler(BUDGET_INPUT_ONLY_BUDGET_LIMIT_CHANGE);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        budgetName: BUDGET_NAME,
        message: 'Budget updated successfully'
      }),
    );

    expect(mockBudgetsClient).toHaveReceivedCommandWith(UpdateBudgetCommand, {
      AccountId: ACCOUNT_ID,
      NewBudget: {
        // Budget
        BudgetName: BUDGET_NAME,
        BudgetLimit: {
          // Spend
          Amount: String(400),
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
      }
    });

    expect(mockBudgetsClient).toHaveReceivedCommandTimes(CreateNotificationCommand, 0);
    expect(mockBudgetsClient).toHaveReceivedCommandTimes(DeleteNotificationCommand, 0);

    expect(mockBudgetsClient).toHaveReceivedCommandTimes(CreateSubscriberCommand, 0);
    expect(mockBudgetsClient).toHaveReceivedCommandTimes(DeleteSubscriberCommand, 0);
  });

  it('should return 400 error when DescribeBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when CreateBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).rejects(NOT_FOUND_ERROR);
    mockBudgetsClient.on(CreateBudgetCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when DescribeNotificationsForBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when DescribeSubscribersForNotificationCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when UpdateBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    mockBudgetsClient.on(UpdateBudgetCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when UpdateBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    mockBudgetsClient.on(UpdateBudgetCommand).resolves({});
    mockBudgetsClient.on(CreateNotificationCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });

  it('should return 400 error when DeleteNotificationCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    mockBudgetsClient.on(UpdateBudgetCommand).resolves({});
    mockBudgetsClient.on(DeleteNotificationCommand).rejects(new Error('Error'));

    const response = await callHandler();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in postBudget'
      }),
    );
  });
});

const callHandler = async (budget?: any) => {
  // return handler(buildApiRequest(DEFAULT_CALLER, {
  //   body: BUDGET_INPUT,
  // }) as any, null)
  return handler(apiGatewayEvent({
    body: JSON.stringify(budget || BUDGET_INPUT),
    requestContext: { accountId: ACCOUNT_ID },
  }), null);
}
