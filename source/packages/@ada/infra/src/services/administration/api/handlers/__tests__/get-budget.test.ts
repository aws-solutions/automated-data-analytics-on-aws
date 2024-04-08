/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { mockClient } from 'aws-sdk-client-mock';
import {
  BudgetsClient,
  DescribeBudgetCommand,
  DescribeNotificationsForBudgetCommand,
  DescribeSubscribersForNotificationCommand,
} from '@aws-sdk/client-budgets';
import { DEFAULT_CALLER } from '../../../../../common/services/testing/default-entities';
import { buildApiRequest } from '../../../../api/api-gateway';
import { handler } from '../get-budget';
import { BUDGET_OUTPUT, 
  EXPECTED_GET_BUDGET_OUTPUT,
  BUDGET_NOTIFICATIONS_OUTPUT,
  BUDGET_SUBSCRIBERS_OUTPUT,
  BUDGET_NOTIFICATIONS_EMPTY,
  NOT_FOUND_ERROR,
} from '../__fixtures__/budget';

const mockBudgetsClient = mockClient(BudgetsClient);

describe('get-budget', () => {
  beforeEach(() => {
    mockBudgetsClient.reset();
  });

  it('should invoke the get-budget lambda and return the budget', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand).resolves(BUDGET_SUBSCRIBERS_OUTPUT);
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...EXPECTED_GET_BUDGET_OUTPUT
      }),
    );
  });

  it('should return the budget with empty notification', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_EMPTY);
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...EXPECTED_GET_BUDGET_OUTPUT,
        softNotifications: [],
        subscriberList: [],
      }),
    );
  });

  it('should returns 404 when budget not found', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).rejects(NOT_FOUND_ERROR);
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Budget not found',
      }),
    );
  });

  it('should returns 400 when DescribeBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).rejects(new Error('Error'));
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in getBudget',
      }),
    );
  });

  it('should returns 400 when DescribeNotificationsForBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).resolves(BUDGET_NOTIFICATIONS_OUTPUT);
    mockBudgetsClient.on(DescribeSubscribersForNotificationCommand)
      .resolvesOnce(BUDGET_SUBSCRIBERS_OUTPUT)
      .rejectsOnce(new Error('Error'))
      .resolves(BUDGET_SUBSCRIBERS_OUTPUT)
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in getBudget',
      }),
    );
  });

  it('should returns 400 when DescribeNotificationsForBudgetCommand throws error', async () => {
    mockBudgetsClient.on(DescribeBudgetCommand).resolves(BUDGET_OUTPUT);
    mockBudgetsClient.on(DescribeNotificationsForBudgetCommand).rejects(new Error('Error'));
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in getBudget',
      }),
    );
  });
});

