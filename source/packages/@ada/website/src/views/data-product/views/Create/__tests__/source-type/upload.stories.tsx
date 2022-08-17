/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { SourceType } from '@ada/common';
import { act } from '@testing-library/react';
import { fireEvent, within } from '@storybook/testing-library';
import { gotoSourceTypeDetails, useSourceTypeTestApiMocks } from '../helpers';

const FILE_JSON = JSON.stringify({ aString: 'my-string', aBoolean: true });
const FILE = new File([FILE_JSON], 'test-file.json', { type: 'application/json' });

export default {
  title: `Views/DataProduct/Create/${SourceType.UPLOAD}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, SourceType.UPLOAD);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('Source File') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [FILE] }
    })
  });

  // File upload requires preview step to extract s3 bucket/key
  // which is not possible in test at this point
};
