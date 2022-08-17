/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { CreateGroupView } from '../../views/Create';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router';
import { act, render } from '@testing-library/react';

jest.mock('@ada/api-client');

describe('CreateGroupView', () => {
  it('should render', async () => {
    API.listApiAccessPolicies.mockResolvedValue({
      policies: [{ apiAccessPolicyId: 'read-only', name: 'Read Only', resources: ['read*'] }],
    });

    await act(async () => {
      const { findAllByText } = render(
        <MockMetaProvider router={{ initialEntries: ['groups/new'] }}>
          <Route path="groups/new">
            <CreateGroupView />
          </Route>
        </MockMetaProvider>,
      );

      expect((await findAllByText('Create group')).length).toBeGreaterThan(0);
      expect((await findAllByText('Enter group details')).length).toBeGreaterThan(0);
    });
  });
});
