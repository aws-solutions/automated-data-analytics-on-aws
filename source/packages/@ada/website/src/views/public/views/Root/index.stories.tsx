/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { LL } from '@ada/strings';
import { MemoryRouter, Route } from 'react-router-dom';
import { MockMetaProviderProps } from '$core/provider/mock';
import { PublicRootView } from './index';
import { TEST_USER } from '$common/entity/user/types';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Public/Root',
  component: PublicRootView,
  parameters: {
    providers: {
      user: {
        userProfile: {
          ...TEST_USER,
          groups: [],
        },
      } as MockMetaProviderProps['user'],
    },
  },
} as ComponentMeta<typeof PublicRootView>;

const Template: ComponentStory<typeof PublicRootView> = (args) => {
  useImmediateEffect(() => {
    API.putIdentityRequest.mockImplementation(async (input) => {
      return input;
    })
  });

  return (
    <MemoryRouter initialEntries={[`/`]}>
      <Route path="/">
        <PublicRootView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});
Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    await delay(100);
  });

  await act(async () => {
    const button = await canvas.findByText(LL.VIEW.PUBLIC.Landing.access.buttonText());
    userEvent.click(button);
  });

  await act(async () => {
    await delay(100);
  });

  expect(canvas.getByText(LL.VIEW.PUBLIC.Landing.access.notify.success.header())).toBeDefined();
};
