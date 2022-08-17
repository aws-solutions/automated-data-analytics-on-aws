/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DELAY } from '$testing/interaction';
import { LL } from '@ada/strings';
import { MemoryRouter, Route } from 'react-router-dom';
import { TEST_USER } from '$common/entity/user/types';
import { TokenEntity } from '@ada/api';
import { USER_ENTITY } from '$testing/__fixtures__';
import { UserDetailView } from './index';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, waitFor, within } from '@storybook/testing-library';

const NEW_TOKEN: Partial<TokenEntity> = {
  machineId: TEST_USER.id,
  tokenId: 'new-token',
  enabled: true,
  expiration: (new Date()).toISOString(),
  createdBy: TEST_USER.id,
  createdTimestamp: (new Date()).toISOString(),
  authToken: 'mock',
  authUrl: 'mock',
  clientId: 'mock',
  clientSecret: 'mock',
  username: TEST_USER.id,
}

export default {
  title: 'Views/User/Detail',
  component: UserDetailView,
  args: {
    onClose: () => {},
  },
} as ComponentMeta<typeof UserDetailView>;

const Template: ComponentStory<typeof UserDetailView> = (args) => {
  useImmediateEffect(() => {
    const tokens: Partial<TokenEntity>[] = [
      {
        tokenId: 'mock-token-1',
        enabled: true,
        expiration: (new Date()).toISOString(),
        createdBy: TEST_USER.id,
        createdTimestamp: (new Date()).toISOString(),
      }
    ]
    API.getIdentityMachine.mockResolvedValue({
      machineId: TEST_USER.id,
    });
    API.listIdentityUsers.mockResolvedValue({
      users: [USER_ENTITY],
    });
    API.listIdentityMachineTokens.mockResolvedValue({
      tokens,
    });
    API.putIdentityMachineToken.mockImplementation(async ({ tokenInput }) => {
      tokens.push(tokenInput);
      return {
        ...NEW_TOKEN,
        ...tokenInput,
      } as TokenEntity;
    });
  });

  return (
    <MemoryRouter initialEntries={[`/user/${TEST_USER.id}`]}>
      <Route path="/user/:userId">
        <UserDetailView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});
Coverage.play = async ({ canvasElement }) => {
  const { getByText } = within(canvasElement);

  await act(async () => {
    await delay(DELAY.SHORT);
  })

  await act(async () => {
    userEvent.click(getByText(LL.ENTITY.Token__CREATE().trim(), { exact: false }))
  })

  await act(async () => {
    await delay(DELAY.SHORT);
  })

  const modal = canvasElement.ownerDocument.body.querySelector('[data-testid="modal"]') as HTMLElement;
  await act(async () => {
    await userEvent.type(
      within(modal).getByLabelText(LL.ENTITY['Token@'].name.label()),
      NEW_TOKEN.tokenId!,
      { delay: DELAY.TYPING }
    )
  })

  await act(async () => {
    userEvent.click(within(modal).getByText('Submit'))
  })

  await waitFor(() => {
    expect(API.putIdentityMachineToken).toHaveBeenCalled();
  })
}
