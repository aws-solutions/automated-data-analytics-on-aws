/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../../index';
import { DataProductUpdateTriggerType, SourceDetailsGoogleStorage, SourceType } from '@ada/common';
import { act } from '@testing-library/react';
import { assertReview, assertSubmit, clickNext, gotoSourceTypeDetails, selectUpdateTriggerType, useSourceTypeTestApiMocks } from '../../helpers';
import { GOOGLE_SOURCE_DETAILS, selectMostRecentAuth, useGoogleSourceTypeTestSetup } from './helpers';
import { userEvent, within } from '@storybook/testing-library';
import { DELAY } from '$testing/interaction';

const SOURCE_DETAILS: SourceDetailsGoogleStorage = {
  ...GOOGLE_SOURCE_DETAILS,
  bucket: 'test-bucket',
  key: 'test-key',
}

export default {
  title: `Views/DataProduct/Create/${SourceType.GOOGLE_STORAGE}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();
  useGoogleSourceTypeTestSetup();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, SourceType.GOOGLE_STORAGE);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('Google Storage Location');
    await userEvent.type(input, `gs://${SOURCE_DETAILS.bucket}/${SOURCE_DETAILS.key}`, { delay: DELAY.TYPING });
  });

  await selectMostRecentAuth(canvasElement);

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertReview(canvasElement, {
    ...SOURCE_DETAILS,
    privateKeyId: '**********',
    privateKey: '**********',
  } as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: SourceType.GOOGLE_STORAGE,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
