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

const SOURCE_DETAILS: Connectors.ORACLE.ISourceDetails = {
  databaseEndpoint: 'localhost',
  databasePort: '1521',
  databaseName: 'ada-test-db',
  databaseTable: 'test-collection',
  username: 'username',
  password: 'password',
  databaseSchema: '',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.ORACLE.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.ORACLE.ID);

  const { getByLabelText } = within(canvasElement);

  await userEvent.type(getByLabelText('Database Endpoint or Host Name'), SOURCE_DETAILS.databaseEndpoint, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Port'), SOURCE_DETAILS.databasePort, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Name'), SOURCE_DETAILS.databaseName, {
    delay: DELAY.TYPING,
  });

  await userEvent.type(getByLabelText('Database Table'), SOURCE_DETAILS.databaseTable, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Username'), SOURCE_DETAILS.username, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Password'), SOURCE_DETAILS.password, { delay: DELAY.TYPING });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.ORACLE.ID, SOURCE_DETAILS as any);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.ORACLE.ID,
    sourceDetails: SOURCE_DETAILS,
  });
};

export const InputError = Template.bind({});

InputError.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.ORACLE.ID);

  const { getByLabelText } = within(canvasElement);
  const { queryByText } = within(canvasElement);

  const input = getByLabelText('Database Endpoint or Host Name');
  await userEvent.type(input, '!@#$', { delay: DELAY.TYPING });
  assert(queryByText('Must be a valid database endpoint'), 'Should show database endpoint error message');
  userEvent.clear(input);

  const input2 = getByLabelText('Database Port');
  await userEvent.type(input2, 'abcd', { delay: DELAY.TYPING });
  assert(queryByText('Must be 0 to 65535'), 'Should show database port error message');
  userEvent.clear(input2);

  const input3 = getByLabelText('Database Name');
  await userEvent.type(input3, ' database-name', { delay: DELAY.TYPING });
  assert(
    queryByText('Must be a valid database name that consists of alphanumeric characters, dash, underscore and dot'),
    'Should show database name error message',
  );
  userEvent.clear(input3);

  const input4 = getByLabelText('Database Table');
  await userEvent.type(input4, ' databasetable', { delay: DELAY.TYPING });
  assert(
    queryByText(
      'Must be a valid database table name that consists of alphanumeric characters, dash, underscore and dot',
    ),
    'Should show database table error message',
  );
  userEvent.clear(input4);

  const input5 = getByLabelText('Database Username');
  await userEvent.type(input5, ' username', { delay: DELAY.TYPING });
  assert(
    queryByText(
      'Must be a valid database user name that consists of alphanumeric characters, dash, underscore and dot',
    ),
    'Should show database username error message',
  );
  userEvent.clear(input5);

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);
};
