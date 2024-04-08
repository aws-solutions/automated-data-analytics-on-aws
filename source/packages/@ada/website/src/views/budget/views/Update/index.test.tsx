/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router';
import { UpdateBudgetView } from '.';
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

describe('UpdateBudgetView', () => {
  it('should render', async () => {
    API.getAdministrationBudgets.mockResolvedValue(EXPECTED_GET_BUDGET_OUTPUT as never);

    const { container } = render(
      <MockMetaProvider router={{ initialEntries: ['admin/budget/edit'] }}>
        <Route path="admin/budget/edit">
          <UpdateBudgetView />
        </Route>
      </MockMetaProvider>);

    expect(await screen.findAllByText('Edit budget')).toHaveLength(2);
    expect(screen.getByText('Enter budget details')).toBeVisible();
    expect(screen.getByLabelText('Budget Limit')).toHaveValue(300);

    const subscriberListComponents = container.querySelectorAll('.MuiChip-label');

    expect(subscriberListComponents[0]).toHaveTextContent('test@example.com');
    expect(subscriberListComponents[1]).toHaveTextContent('test@domain.example.com');
  });
});
