/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { userEvent, within } from '@storybook/testing-library';

import { CreateApiKeyDialog } from './index';
import { TEST_USER } from '$common/entity/user/types';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/User/dialog/CreateApiKeyDialog',
  component: CreateApiKeyDialog,
  args: {
    onClose: () => {},
  },
} as ComponentMeta<typeof CreateApiKeyDialog>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CreateApiKeyDialog> = (args) => {
  useImmediateEffect(() => {
    API.getIdentityMachine.mockResolvedValue({
      machineId: TEST_USER.id,
    });
    API.putIdentityMachineToken.mockResolvedValue({
      machineId: TEST_USER.id,
      tokenId: 'mock-token',
      expiration: new Date().toISOString(),
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      authToken: 'mock-auth-token',
      authUrl: 'mock-auth-url',
    });
    API.putQuerySavedQuery.mockImplementation(({ namespace, queryId, savedQueryInput }) => {
      return Promise.resolve({
        queryId,
        namespace,
        ...savedQueryInput,
      });
    });
  });

  return <CreateApiKeyDialog {...args} />;
};

export const Primary = Template.bind({});

export const Submit = Template.bind({});

Submit.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    await delay(10);
    await userEvent.type(canvas.getByLabelText('Name'), 'TestAPIKey', { delay: 10 });
  });

  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText('Submit'));
  });

  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText('Show'));
  });
};
