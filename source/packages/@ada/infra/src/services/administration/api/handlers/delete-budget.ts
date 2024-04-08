/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import {
  BudgetsClient, DeleteBudgetCommand,
  DeleteBudgetCommandInput, NotFoundException,
} from '@aws-sdk/client-budgets';
import { getBudgetName } from '../../constant';

const REGION = process.env.AWS_REGION || '';
const BUDGET_NAME = getBudgetName(REGION);

/**
 * Handler for deleting a Budget
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteAdministrationBudgets',
  async (_request, _callingUser, event, { log }) => {
    try {
      const client = new BudgetsClient({ region: process.env.AWS_REGION });
      const accountId = event.requestContext.accountId;

      const input: DeleteBudgetCommandInput = {
        AccountId: accountId,
        BudgetName: BUDGET_NAME,
      }
  
      log.info('DeleteBudgetCommand input', input);
      const output = await client.send(new DeleteBudgetCommand(input));
      log.info('DeleteBudgetCommand output', output);

      return ApiResponse.success({
        budgetName: BUDGET_NAME,
        message: 'Budget deleted successfully'
      });
    } catch (e: any) {
      if(e instanceof NotFoundException) {
        log.info('Budget not found', e);
        return ApiResponse.notFound({
          message: 'Budget not found',
        });
      }

      log.error('DeleteBudgetCommand error', e);
      return ApiResponse.badRequest({
        message: 'Error in deleteBudget'
      });
    }
  },
);
