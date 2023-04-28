/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { DELAY } from '$testing/interaction';
import { DataProductUpdateTriggerType } from '@ada/common';
import {
  assertReview,
  assertSubmit,
  clickNext,
  gotoSourceTypeDetails,
  selectUpdateTriggerType,
  useSourceTypeTestApiMocks,
} from '../helpers';
import { userEvent, within } from '@storybook/testing-library';
import assert from 'assert';

const SOURCE_DETAILS: Connectors.AmazonCloudWatch.ISourceDetails = {
  since: '2021-10-31T00:00:00.000Z',
  until: '2021-12-31T00:00:00.000Z',
  cloudwatchLogGroupArn: 'arn:aws:logs:ap-southeast-2:00000000000:log-group:/aws/lambda/cw:*',
  query: 'fields @timestamp, @message',
  crossAccountRoleArn: 'arn:aws:iam::111111111111:role/xacctrole',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.AmazonCloudWatch.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonCloudWatch.ID);

  const { getByLabelText } = within(canvasElement);

  await userEvent.type(getByLabelText('CloudWatch Log Group ARN'), SOURCE_DETAILS.cloudwatchLogGroupArn, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('CloudWatch Query'), SOURCE_DETAILS.query, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('CloudWatch Logs Access IAM Role ARN'), SOURCE_DETAILS.crossAccountRoleArn!, {
    delay: DELAY.TYPING,
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await userEvent.type(getByLabelText('Since'), SOURCE_DETAILS.since, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Until'), SOURCE_DETAILS.until!, { delay: DELAY.TYPING });

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.AmazonCloudWatch.ID, SOURCE_DETAILS as any);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.AmazonCloudWatch.ID,
    sourceDetails: SOURCE_DETAILS,
  });
};

export const InputError = Template.bind({});

InputError.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonCloudWatch.ID);

  const { getByLabelText } = within(canvasElement);

  const input = getByLabelText('CloudWatch Log Group ARN');
  await userEvent.type(input, 'bad-cloudwatch-arn', { delay: DELAY.TYPING });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  const { queryByText } = within(canvasElement);
  assert(queryByText('Must be a valid Amazon CloudWatch Log Group ARN'), 'Should show Cloudwatch ARN error message');

  userEvent.clear(input);
  await userEvent.type(input, SOURCE_DETAILS.cloudwatchLogGroupArn, { delay: DELAY.TYPING });

  const input2 = getByLabelText('CloudWatch Query');
  await userEvent.type(input2, 'A', { delay: DELAY.TYPING });

  assert(queryByText('Must be a valid Amazon CloudWatch query pattern'), 'Should show Query error message');
};
