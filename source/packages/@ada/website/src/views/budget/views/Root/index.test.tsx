/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API,  } from '@ada/api-client/mock';
import { BudgetRootView } from '.';
import { LL } from '@ada/strings';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router';
import { render, screen } from '@testing-library/react';
jest.mock('@ada/api-client');

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

describe('BudgetRootView', () => {
  it('should render BudgetDetail if budget exists', async () => {
    API.getAdministrationBudgets.mockResolvedValue(EXPECTED_GET_BUDGET_OUTPUT as never);

    render(
      <MockMetaProvider router={{ initialEntries: ['admin/budget/edit'] }}>
        <Route path="admin/budget/edit">
          <BudgetRootView />
        </Route>
      </MockMetaProvider>);

    expect(await screen.findByText(LL.VIEW.BUDGET.DETAILS.budgetAmount())).toBeVisible();
    expect(await screen.findByText(LL.ENTITY.Budget__UPDATE())).toBeVisible();
    expect(await screen.findByText(LL.ENTITY.Budget__DELETE())).toBeVisible();
  });

  it('should render BudgetDetail if budget dost not exist', async () => {
    //@ts-ignore
    API.getAdministrationBudgets.mockImplementation(async () => {
      throw {
        message: 'Budget not found',
        statusCode: 404 
      };
    });

    render(
      <MockMetaProvider router={{ initialEntries: ['admin/budget/edit'] }}>
        <Route path="admin/budget/edit">
          <BudgetRootView />
        </Route>
      </MockMetaProvider>);

    expect(await screen.findByText(new RegExp(LL.VIEW.BUDGET.DETAILS.intro.prefix()))).toBeVisible();
    expect(await screen.findByText(new RegExp(LL.VIEW.BUDGET.DETAILS.intro.suffix()))).toBeVisible();
    expect(await screen.findByText(LL.ENTITY.Budget__CREATE())).toBeVisible();
  });
});
