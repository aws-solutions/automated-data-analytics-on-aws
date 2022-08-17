/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateIdentityProviderView } from './index';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/IdentityProvider/Create',
  component: CreateIdentityProviderView,
} as ComponentMeta<typeof CreateIdentityProviderView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CreateIdentityProviderView> = () => {
  return <CreateIdentityProviderView />;
};

export const Primary = Template.bind({});
