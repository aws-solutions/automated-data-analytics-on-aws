/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';

export const BUDGET = {
  title: ENTITY.Budget,
  nav: ENTITY.Budget,

  HELP: {
    ROOT: {
      header: ENTITY.Budget,
    },
  },
  WIZARD: {
    description: 'Enter budget details',
  },
  DETAILS: {
    intro: {
      prefix: 'Admins can create a',
      suffix: 'with a cost limit to track costs and usage for the solution, and receive notifications if the costs exceed certain thresholds.'
    },
    actualSpend: 'Current vs Budgeted',
    forecastedSpend: 'Forecasted vs Budgeted (MTD)',
    spendAdditionalInfo: 'Amount spent: ${0:number} of ${1:number}',
    budgetHealth: 'Budget Health',
    budgetAmount: 'Budget Amount',
    budgetNotifications: 'Notifications',
    NOTIFICATION: {
      labelCost: 'Actual Cost > {0:number}% (${1:string})',
      labelDefinition: 'Definition',
      contentDefiniton: 'When your actual cost is greater than {0:number}% (${1:string}) of your budgeted amount (${2:string}), the alert threshold will be exceeded.',
      labelThreshold: 'Threshold',
      labelSubscribers: 'Subscribers',
      statusNotExceeded: 'Not exceeded',
      statusExceeded: 'Exceeded',
    }
  },
  DELETE: {
    CONFIRM: {
      title: 'Delete budget setting',
      confirmationText: 'delete',
      deleteButtonText: 'Delete',
      content: 'This will delete the budget limit setting and all the notification settings associated with the budget limit.',
      htmlLabel: 'To confirm deletion, type "<i><b>delete</b></i>" below'
    },
    NOTIFY: {
      error: {
        header: 'Failed to delete budget',
      },
      success: {
        header: 'Successfully deleted budget',
      },
    }
  },
} as const;
