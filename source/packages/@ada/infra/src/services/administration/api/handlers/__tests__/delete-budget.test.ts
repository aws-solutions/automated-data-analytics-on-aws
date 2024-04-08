/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { mockClient }from 'aws-sdk-client-mock';
import {
  BudgetsClient,
  DeleteBudgetCommand,
} from '@aws-sdk/client-budgets';
import { DEFAULT_CALLER } from '../../../../../common/services/testing/default-entities';
import { buildApiRequest } from '../../../../api/api-gateway';
import { handler } from '../delete-budget';
import { BUDGET_NAME, NOT_FOUND_ERROR } from '../__fixtures__/budget';

const mockBudgetsClient = mockClient(BudgetsClient);

describe('delete-budget', () => {
  beforeEach(() => {
    mockBudgetsClient.reset();
  });
  
  it('should invoke the delete-budget lambda', async () => {
    mockBudgetsClient.on(DeleteBudgetCommand).resolves({});
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        budgetName: BUDGET_NAME,
        message: 'Budget deleted successfully'
      }),
    );
  });

  it('should return 404 error when budget not found', async () => {
    mockBudgetsClient.on(DeleteBudgetCommand).rejects(NOT_FOUND_ERROR);
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Budget not found',
      }),
    );
  });

  it('should return 400 error when error occurs', async () => {
    mockBudgetsClient.on(DeleteBudgetCommand).rejects(new Error('Error'));
    const response = await handler(buildApiRequest(DEFAULT_CALLER, {}) as any, null);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        message: 'Error in deleteBudget'
      }),
    );
  });
});
