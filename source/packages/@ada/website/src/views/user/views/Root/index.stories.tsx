/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DefaultGroupIds } from '@ada/common';
import { MemoryRouter, Route } from 'react-router-dom';
import { MockMetaProviderProps } from '$core/provider/mock';
import { TEST_USER } from '$common/entity/user/types';
import { UserRootView } from './index';
import { useImmediateEffect } from '$common/hooks';

export default {
  title: 'Views/User/Root',
  component: UserRootView,
  parameters: {
    providers: {
      user: {
        userProfile: {
          ...TEST_USER,
          groups: [DefaultGroupIds.DEFAULT, DefaultGroupIds.POWER_USER],
        },
      } as MockMetaProviderProps['user'],
    },
  },
} as ComponentMeta<typeof UserRootView>;

const Template: ComponentStory<typeof UserRootView> = (args) => {
  useImmediateEffect(() => {
    API.listIdentityUsers.mockResolvedValue({
      users: [
        TEST_USER,
        {
          username: 'mock-1',
          preferredUsername: 'mock-user-1',
          name: 'Mock User',
          email: 'mock-user@example.com',
          customGroups: [DefaultGroupIds.ADMIN].join(','),
        }
      ]
    })
  })

  return (
    <MemoryRouter initialEntries={[`/`]}>
      <Route path="/">
        <UserRootView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});
