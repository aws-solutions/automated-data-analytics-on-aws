/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { DataProductUpdateTriggerType, SourceDetailsS3, SourceType } from '@ada/common';
import { act } from '@testing-library/react';
import { userEvent, within } from '@storybook/testing-library';
import { assertReview, assertSubmit, clickNext, gotoSourceTypeDetails, selectUpdateTriggerType, useSourceTypeTestApiMocks } from '../helpers';
import { DELAY } from '$testing/interaction';

const SOURCE_DETAILS: SourceDetailsS3 = {
  key: 'test-key',
  bucket: 'test-bucket',
}

export default {
  title: `Views/DataProduct/Create/${SourceType.S3}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, SourceType.S3);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('S3 Location');
    await userEvent.type(input, `s3://${SOURCE_DETAILS.bucket}/${SOURCE_DETAILS.key}`, { delay: DELAY.TYPING });
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.AUTOMATIC);

  await clickNext(canvasElement);

  await assertReview(canvasElement, SOURCE_DETAILS as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: SourceType.S3,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
