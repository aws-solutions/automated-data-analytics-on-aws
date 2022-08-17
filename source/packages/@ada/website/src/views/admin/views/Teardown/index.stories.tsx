/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { MockMetaProviderProps } from '$core/provider/MetaProvider/mock';
import { ROOT_ADMIN_ID } from '@ada/common';
import { TEST_USER } from '$common/entity/user/types';
import { TearDownDetails } from '@ada/api';
import { TeardownView } from './index';
import { act } from '@testing-library/react';
import { build as buildArn } from '@aws-sdk/util-arn-parser';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';

export const TEARDOWN_DETAILS: TearDownDetails = {
  coreStackId: 'Stack23452dsf',
  mode: 'destroy-data',
  message: 'Test message',
  retainedResources: [
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 's3', resource: 'bucket-1' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 's3', resource: 'bucket-2' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'kms', resource: 'key/bucket-1-key' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'kms', resource: 'alias/bucket-1-key-alias' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'kms', resource: 'key/bucket-2-key' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'kms', resource: 'alias/bucket-2-key-alias' }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'logs', resource: 'log-group:TestLogGroup1' }),
    buildArn({
      accountId: '1111111111',
      region: 'test-us-1',
      service: 'logs',
      resource: 'log-group:TestLogGroup1:log-stream:TestLogStream1',
    }),
    buildArn({ accountId: '1111111111', region: 'test-us-1', service: 'something', resource: 'unmapped-resource' }),
  ],
};

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Teardown/Root',
  component: TeardownView,
  args: {},
  parameters: {
    providers: {
      user: {
        userProfile: {
          ...TEST_USER,
          id: ROOT_ADMIN_ID,
        },
      } as MockMetaProviderProps['user'],
    },
  },
} as ComponentMeta<typeof TeardownView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof TeardownView> = (args) => {
  useImmediateEffect(() => {
    API.deleteAdministrationStartTearDownDestroyData.mockResolvedValue(TEARDOWN_DETAILS);
    return () => {
      jest.clearAllMocks();
    };
  });

  return <TeardownView {...args} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    userEvent.click(await canvas.findByText('Delete solution and data'));
    await userEvent.type(
      await canvas.findByPlaceholderText('permanently delete and data'),
      'permanently delete and data',
      { delay: 10 },
    );
    userEvent.click(await canvas.findByText('Permanently Delete'));
    userEvent.click(await canvas.findByText('Copy details'));
  });
};
