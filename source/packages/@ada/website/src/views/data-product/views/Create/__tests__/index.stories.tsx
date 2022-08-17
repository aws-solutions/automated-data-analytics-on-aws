/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../index';
import { setPersistentGoogleServiceAccountDetails } from '$source-type/google/common/google-session-credentials';
import { useImmediateEffect } from '$common/hooks';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/DataProduct/Create',
  component: CreateDataProductView,
  parameters: {
    notFound: false,
  },
} as ComponentMeta<typeof CreateDataProductView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useImmediateEffect(() => {
    setPersistentGoogleServiceAccountDetails(fixtures.GOOGLE_SERVICE_ACCOUNT);
  })

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});
