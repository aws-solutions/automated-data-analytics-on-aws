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

const SOURCE_DETAILS: Connectors.AmazonDynamoDB.ISourceDetails = {
  dynamoDbTableArn: 'arn:aws:dynamodb:us-west-2:000000000000:table/1-test-data',
  crossAccountRoleArn: 'arn:aws:iam::000000000000:role/DynamoDB-FullAccess-For-Account-123456789',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.AmazonDynamoDB.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonDynamoDB.ID);

  const { getByLabelText, findByText } = within(canvasElement);

  const input = getByLabelText('DynamoDB Table Arn');
  await userEvent.type(input, SOURCE_DETAILS.dynamoDbTableArn, { delay: DELAY.TYPING });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  assert(await findByText('arn:aws:dynamodb:us-west-2:11111111111:table/1-test-data/stream/foo'));

  await clickNext(canvasElement);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.AmazonDynamoDB.ID,
    sourceDetails: { dynamoDbTableArn: SOURCE_DETAILS.dynamoDbTableArn },
  });
};

export const PrimaryCrossAccount = Template.bind({});

PrimaryCrossAccount.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonDynamoDB.ID);

  const { getByLabelText } = within(canvasElement);

  const input = getByLabelText('DynamoDB Table Arn');
  await userEvent.type(input, SOURCE_DETAILS.dynamoDbTableArn, { delay: DELAY.TYPING });

  const input2 = getByLabelText('Cross Account Role Arn');
  await userEvent.type(input2, SOURCE_DETAILS.crossAccountRoleArn, { delay: DELAY.TYPING });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.AmazonDynamoDB.ID, SOURCE_DETAILS as any);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.AmazonDynamoDB.ID,
    sourceDetails: SOURCE_DETAILS,
  });
};

export const InputError = Template.bind({});

InputError.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonDynamoDB.ID);

  const { getByLabelText, findByLabelText } = within(canvasElement);

  const input = getByLabelText('DynamoDB Table Arn');
  await userEvent.type(input, 'bad-table-arn', { delay: DELAY.TYPING });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  const { queryByText } = within(canvasElement);
  assert(queryByText('Must be a valid arn for Amazon DynamoDB Table'), 'Should show Table ARN error message');

  await userEvent.clear(input);
  await userEvent.type(input, SOURCE_DETAILS.dynamoDbTableArn, { delay: DELAY.TYPING });

  const input3 = await findByLabelText('Cross Account Role Arn');
  await userEvent.type(input3, 'bad role', { delay: DELAY.TYPING });

  assert(queryByText('Must be a valid arn for an IAM Role'), 'Should show Role ARN error message');
};

export const SwappedValueError = Template.bind({});
