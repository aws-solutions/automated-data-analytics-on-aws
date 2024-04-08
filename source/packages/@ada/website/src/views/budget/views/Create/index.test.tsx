/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateBudgetView } from '.';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router';
import { act, render, screen } from '@testing-library/react';

jest.mock('@ada/api-client');

describe('CreateBudgetView', () => {
  it('should render', async () => {
    render(
      <MockMetaProvider router={{ initialEntries: ['admin/budget/new'] }}>
        <Route path="admin/budget/new">
          <CreateBudgetView />
        </Route>
      </MockMetaProvider>);
    
    await act(async () => {
      expect(await screen.findAllByText('Create budget')).toHaveLength(2);
      expect(screen.getByText('Enter budget details')).toBeVisible();
    });
  });
});
