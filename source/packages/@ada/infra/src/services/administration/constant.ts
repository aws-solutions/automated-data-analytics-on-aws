/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const getBudgetName = (region: string) => {
  return `AWS_Solution_Ada_${region}`;
}

export const BUDGET_COST_FILTER = 'user:Application$Ada';
export const BUDGET_CURRENCY = 'USD';

export const IAM_VIEW_BUDGET = 'budgets:ViewBudget';
export const IAM_MODIFY_BUDGET = 'budgets:ModifyBudget';

export const NOTIFICATION_TYPE = 'ACTUAL';
export const NOTIFICATION_COMPARISON_OPERATOR = 'GREATER_THAN';
export const NOTIFICATION_THRESHOLD_TYPE = 'PERCENTAGE';
export const NOTIFICATION_STATE = 'OK';

export const SUBSCRIPTION_TYPE = 'EMAIL';

