/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../../index';
import { DataProductUpdateTriggerType } from '@ada/common';
import { act } from '@testing-library/react';
import { assertReview, assertSubmit, clickNext, gotoSourceTypeDetails, selectUpdateTriggerType, useSourceTypeTestApiMocks } from '../../helpers';
import { GOOGLE_SOURCE_DETAILS, selectMostRecentAuth, useGoogleSourceTypeTestSetup } from './helpers';
import { userEvent, within } from '@storybook/testing-library';
import { DELAY } from '$testing/interaction';
import * as Connectors from '@ada/connectors';

const SOURCE_DETAILS: Connectors.GoogleStorage.ISourceDetails = {
  ...GOOGLE_SOURCE_DETAILS,
  bucket: 'test-bucket',
  key: 'test-key',
}

export default {
  title: `Views/DataProduct/Create/${Connectors.GoogleStorage.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();
  useGoogleSourceTypeTestSetup();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.GoogleStorage.ID);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('Google Storage Location');
    await userEvent.type(input, `gs://${SOURCE_DETAILS.bucket}/${SOURCE_DETAILS.key}`, { delay: DELAY.TYPING });
  });

  await selectMostRecentAuth(canvasElement);

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.GoogleStorage.ID, {
    ...SOURCE_DETAILS,
    privateKeyId: '**********',
    privateKey: '**********',
  } as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: Connectors.GoogleStorage.ID,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
