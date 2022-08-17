/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { AccessRequestContext, IAccessRequestContext } from '$common/entity/access-request';
import { GroupRootView } from '.';
import { MockMetaProvider } from '$core/provider/mock';
import { act, render } from '@testing-library/react';
import { delay } from '$common/utils';

jest.mock('@ada/api-client');

API.listIdentityGroups.mockResolvedValue({
  groups: [
    {
      groupId: 'admin',
      description: 'First Group',
      claims: ['claim-1', 'claim-2'],
      members: ['user-1', 'user-2'],
      createdBy: 'system',
    },
    {
      groupId: 'viewer',
      description: 'Second Group',
      claims: ['claim-4', 'claim-5'],
      members: ['user-4', 'user-5'],
      createdBy: 'user-a',
    },
  ],
});
API.listIdentityRequests.mockRejectedValue({
  accessRequests: [],
});

describe('GroupRootView', () => {
  it('should list all groups', async () => {
    const accessRequestContext: IAccessRequestContext = {
      accessRequests: [],
      hasPendingAccessRequests: false,
      approveRequest: jest.fn(),
      denyRequest: jest.fn(),
      getAccessRequestAcknowledgement: jest.fn(),
    }

    const { findByText } = render(
      <MockMetaProvider amplify>
        <AccessRequestContext.Provider value={accessRequestContext}>
          <GroupRootView />
        </AccessRequestContext.Provider>
      </MockMetaProvider>,
    );

    await act(async () => {
      await delay(1000);
    })

    expect(await findByText('Admin')).toBeInTheDocument();
    expect(await findByText('Viewer')).toBeInTheDocument();
    expect(await findByText('user-1, user-2')).toBeInTheDocument();
    expect(await findByText('user-4, user-5')).toBeInTheDocument();
  });
});
