/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { Container } from 'aws-northstar';
import { DELAY } from '$testing/interaction';
import { NotificationProvider } from '$northstar-plus';
import { PersistentNotifications } from '.';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { screen, userEvent, within } from '@storybook/testing-library';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'App/Notifications',
  component: PersistentNotifications,
  parameters: {
    providers: {
      custom: (({ children }) => <NotificationProvider>{children}</NotificationProvider>) as React.FC,
    },
  },
  args: {
    dismissAll: true,
    dismissAllThreshold: 2,
  },
} as ComponentMeta<typeof PersistentNotifications>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof PersistentNotifications> = (args) => {
  return (
    <Container title="Notification Stories" actionGroup={<PersistentNotifications {...args} />}>
      <div style={{ height: 400 }}>CLICK THE NOTIFICATION ICON TO SEE</div>
    </Container>
  );
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.args = {
  dismissAll: false,
};
Coverage.play = async ({ canvasElement }) => {
  const { getByTestId } = within(canvasElement);

  let count = fixtures.NOTIFICATIONS.length;

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.MEDIUM);
  });

  const menu = await getByTestId('notifications-menu');
  const menuButton = menu.querySelector('button')!;

  await act(async () => {
    userEvent.click(menuButton);
  });

  const initialMenuItems = await screen.findAllByRole('menuitem');
  expect(initialMenuItems.length).toBe(count);

  for (let i = 0; i < initialMenuItems.length; i++) {
    expect(getChipCount(menu)).toBe(count);
    await act(async () => {
      const dismissButton = within(initialMenuItems[i]).getByLabelText('Close');
      userEvent.click(dismissButton);
    });

    await act(async () => {
      await delay(DELAY.MEDIUM);
    });

    count--;
    expect((screen.queryAllByRole('menuitem') || []).length).toBe(count);

    expect(getChipCount(menu)).toBe(count);
  }

  await act(async () => {
    await delay(DELAY.SHORT);
  });
};

function getChipCount(menu: HTMLElement): number {
  const countLabel = menu.querySelector('.MuiChip-label');

  return parseInt(countLabel?.textContent || '0');
}
