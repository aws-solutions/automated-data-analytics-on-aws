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
import { multiselectOptionEvent } from '$testing/user-event';
import { act } from '@testing-library/react';

const SOURCE_DETAILS: Connectors.MongoDB.ISourceDetails = {
  databaseEndpoint: 'localhost',
  databasePort: '27017',
  databaseName: 'ada-test-db',
  collectionName: 'test-collection',
  username: 'username',
  password: 'password',
  tls: 'false',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.MongoDB.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.MongoDB.ID);

  const { getByLabelText } = within(canvasElement);

  await userEvent.type(getByLabelText('Database Endpoint or Host Name'), SOURCE_DETAILS.databaseEndpoint, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Port'), SOURCE_DETAILS.databasePort, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Name'), SOURCE_DETAILS.databaseName, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Collection'), SOURCE_DETAILS.collectionName, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Username'), SOURCE_DETAILS.username, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Password'), SOURCE_DETAILS.password, {
    delay: DELAY.TYPING,
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.MongoDB.ID,
    sourceDetails: SOURCE_DETAILS,
  });
};
