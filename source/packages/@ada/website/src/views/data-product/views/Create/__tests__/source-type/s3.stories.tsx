/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { DELAY } from '$testing/interaction';
import { DataProductUpdatePolicy, DataProductUpdateTriggerType } from '@ada/common';
import { act } from '@testing-library/react';
import {
  assertReview,
  assertSubmit,
  clickNext,
  gotoSourceTypeDetails,
  selectUpdatePolicy,
  selectUpdateTriggerType,
  useSourceTypeTestApiMocks,
} from '../helpers';
import { userEvent, within } from '@storybook/testing-library';

const SOURCE_DETAILS: Connectors.AmazonS3.ISourceDetails = {
  key: 'test-key',
  bucket: 'test-bucket',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.AmazonS3.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonS3.ID);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('S3 Location');
    await userEvent.type(input, `s3://${SOURCE_DETAILS.bucket}/${SOURCE_DETAILS.key}`, { delay: DELAY.TYPING });
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.AUTOMATIC);

  await selectUpdatePolicy(canvasElement, DataProductUpdatePolicy.REPLACE);

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.AmazonS3.ID, SOURCE_DETAILS as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: Connectors.AmazonS3.ID,
      sourceDetails: SOURCE_DETAILS,
    });
  });
};
