/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { DataProductUpdateTriggerType, SourceDetailsKinesis, SourceType } from '@ada/common';
import { act } from '@testing-library/react';
import { userEvent, within } from '@storybook/testing-library';
import { assertReview, assertSubmit, clickNext, gotoSourceTypeDetails, selectUpdateTriggerType, useSourceTypeTestApiMocks } from '../helpers';
import { DELAY } from '$testing/interaction';

const SOURCE_DETAILS: SourceDetailsKinesis = {
  kinesisStreamArn: 'arn:aws:kinesis:region:1234567890:stream/stream-name',
}

export default {
  title: `Views/DataProduct/Create/${SourceType.KINESIS}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, SourceType.KINESIS);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('Kinesis Data Stream Arn');
    await userEvent.type(input, SOURCE_DETAILS.kinesisStreamArn, { delay: DELAY.TYPING });
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.AUTOMATIC);

  await clickNext(canvasElement);

  await assertReview(canvasElement, SOURCE_DETAILS as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: SourceType.KINESIS,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
