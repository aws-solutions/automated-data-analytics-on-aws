/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { AccessRequestProvider } from '$common/entity/access-request';
import { ApiError, GroupEntity } from '@ada/api';
import { GroupDetailView } from '.';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router-dom';
/* eslint-disable-next-line */
import { RequestError } from '$api/client/__mocks__';
import { act, fireEvent, render } from '@testing-library/react';

jest.mock('@ada/api-client');

// TODO: refactor group details test after we update the UI

const GROUP: GroupEntity = {
  groupId: 'group1',
  description: 'First Group',
  claims: ['claim-1', 'claim-2'],
  members: ['user-1', 'user-2'],
  apiAccessPolicyIds: ['api-1', 'api-2'],
  createdBy: 'creator',
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedBy: 'updater',
  updatedTimestamp: '2021-01-01T00:00:01Z',
};

describe('GroupDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    API.getIdentityGroup.mockResolvedValue(GROUP);

    API.listIdentityGroups.mockResolvedValue({
      groups: [GROUP],
    });

    API.listIdentityUsers.mockResolvedValue({
      users: [
        { username: 'user-1', preferredUsername: 'user-1', name: 'User 1' },
        { username: 'user-2', preferredUsername: 'user-2', name: 'User 2' },
      ],
    });

    API.listIdentityRequests.mockRejectedValue({
      accessRequests: [],
    });
  });
  it('should show group details', async () => {
    const { findByText } = render(
      <MockMetaProvider amplify router={{ initialEntries: ['groups/group1'] }}>
        <Route path="groups/:groupId">
          <AccessRequestProvider>
            <GroupDetailView />
          </AccessRequestProvider>
        </Route>
      </MockMetaProvider>,
    );

    expect(await findByText('Group 1')).toBeInTheDocument();
    expect(await findByText('First Group')).toBeInTheDocument();
    expect(await findByText('user-1')).toBeInTheDocument();
    expect(await findByText('user-2')).toBeInTheDocument();
  });

  it.skip('should display an error if the update fails', async () => {
    API.putIdentityGroup.mockImplementation(() => {
      throw new RequestError('any-update-error', {
        message: 'Error updating the group',
      });
    });

    const { findByText } = render(
      <MockMetaProvider amplify router={{ initialEntries: ['groups/group1'] }}>
        <Route path="groups/:groupId">
          <AccessRequestProvider>
            <GroupDetailView />
          </AccessRequestProvider>
        </Route>
      </MockMetaProvider>,
    );

    const updateGroup = await findByText('Update Group');
    await act(async () => {
      fireEvent.click(updateGroup);
    });
    expect(await findByText('Error updating the group')).toBeInTheDocument();
  });

  it('should show an error when the group does not exist', async () => {
    API.getIdentityGroup.mockRejectedValue({
      message: 'Group not found!',
    } as ApiError);

    const { findByText } = render(
      <MockMetaProvider amplify router={{ initialEntries: ['groups/not-a-group'] }}>
        <Route path="groups/:groupId">
          <AccessRequestProvider>
            <GroupDetailView />
          </AccessRequestProvider>
        </Route>
      </MockMetaProvider>,
    );

    expect(await findByText('Not found')).toBeInTheDocument();
  });
});
