/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../../index';
import { DataProductUpdateTriggerType, DataProductUpdatePolicy } from '@ada/common';
import { act } from '@testing-library/react';
import { userEvent, within } from '@storybook/testing-library';
import {
  assertReview,
  assertSubmit,
  clickNext, 
  gotoSourceTypeDetails,
  selectUpdateTriggerType, 
  useSourceTypeTestApiMocks,
  selectUpdatePolicy
} from '../../helpers';
import { DELAY } from '$testing/interaction';
import {
  GOOGLE_SOURCE_DETAILS,
  selectMostRecentAuth,
  useGoogleSourceTypeTestSetup
} from './helpers';
import { multiselectOptionEvent } from '$testing/user-event';
import * as Connectors from '@ada/connectors';

const SOURCE_DETAILS: Connectors.GoogleAnalytics.ISourceDetails = {
  ...GOOGLE_SOURCE_DETAILS,
  viewId: '12345678',
  dimensions: 'ga:userType,ga:visitCount',
  metrics: 'ga:visitors,ga:visits',
  since: '2022-01-01',
  until: '2022-02-01',
}

export default {
  title: `Views/DataProduct/Create/${Connectors.GoogleAnalytics.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();
  useGoogleSourceTypeTestSetup();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
Primary.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.GoogleAnalytics.ID);

  const { getByLabelText } = within(canvasElement);

  await act(async () => {
    const input = getByLabelText('View Id');
    await userEvent.type(input, SOURCE_DETAILS.viewId, { delay: DELAY.TYPING });
  });

  for (const dimension of SOURCE_DETAILS.dimensions.split(',')) {
    await act(async () => {
      await multiselectOptionEvent(canvasElement, 'Dimensions', dimension);
    });
  }

  for (const metric of SOURCE_DETAILS.metrics.split(',')) {
    await act(async () => {
      await multiselectOptionEvent(canvasElement, 'Metrics', metric);
    });
  }

  await selectMostRecentAuth(canvasElement);

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);

  await selectUpdatePolicy(canvasElement, DataProductUpdatePolicy.REPLACE);

  await act(async () => {
    await userEvent.type(getByLabelText('Since'), SOURCE_DETAILS.since!, { delay: DELAY.TYPING });
  });

  await act(async () => {
    await userEvent.type(getByLabelText('Until'), SOURCE_DETAILS.until!, { delay: DELAY.TYPING });
  });

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.GoogleAnalytics.ID, {
    ...SOURCE_DETAILS,
    privateKeyId: '**********',
    privateKey: '**********',
  } as any);

  await act(async () => {
    await assertSubmit(canvasElement, {
      sourceType: Connectors.GoogleAnalytics.ID,
      sourceDetails: SOURCE_DETAILS,
    });
  })
};
