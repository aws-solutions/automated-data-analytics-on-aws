/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types';

export const Budget: StringEntityDefinition<'Budget'> = {
  Budget: 'Budget',
  Budgets: 'Budgets',
  budget: 'budget',
  budgets: 'budgets',

  description: 'A Budget setting for ada infrastructure costs',
  descriptions: 'A list of budgets for infrastructure costs',

  properties: {
    budgetLimit: {
      label: 'Budget Limit',
      description: 'The cost limit in USD for the Budget',
      placeholder: 'Enter budget limit, eg 100...',
    },
    subscriberList: {
      label: 'Subscriber List',
      description: 'The subscribers to recieve notification',
      placeholder: 'Enter the subscriber email addresses...',
    },
    softNotifications: {
      label: 'Notification Percentages',
      description: 'The subscribers will be notified when the costs reach these percentages of the budget',
    },
  },
};

export default Budget;
