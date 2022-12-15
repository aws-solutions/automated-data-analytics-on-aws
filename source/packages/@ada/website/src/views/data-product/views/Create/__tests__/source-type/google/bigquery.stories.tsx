/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../../index';
import { DataProductUpdateTriggerType } from '@ada/common';
import { act } from '@testing-library/react';
import { assertReview, assertSubmit, clickNext, gotoSourceTypeDetails, selectUpdateTriggerType, useSourceTypeTestApiMocks } from '../../helpers';
import { GOOGLE_SOURCE_DETAILS, selectMostRecentAuth, useGoogleSourceTypeTestSetup } from './helpers';
import { findSQLEditor } from '$testing/sql-editor';
import * as Connectors from '@ada/connectors';

const SOURCE_DETAILS: Connectors.GoogleBigQuery.ISourceDetails = {
  ...GOOGLE_SOURCE_DETAILS,
  query: 'SELECT * FROM table'
}

export default {
  title: `Views/DataProduct/Create/${Connectors.GoogleBigQuery.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();
  useGoogleSourceTypeTestSetup();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.GoogleBigQuery.ID);

  await act(async () => {
    const sqlEditor = await findSQLEditor(canvasElement);
    await sqlEditor.setValue(SOURCE_DETAILS.query);
  });

  await selectMostRecentAuth(canvasElement);

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.GoogleBigQuery.ID, {
    ...SOURCE_DETAILS,
    privateKeyId: '**********',
    privateKey: '**********',
  } as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: Connectors.GoogleBigQuery.ID,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
