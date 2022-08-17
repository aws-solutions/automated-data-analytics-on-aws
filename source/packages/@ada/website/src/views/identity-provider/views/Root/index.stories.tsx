/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { IdentityProviderRootView } from './index';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/IdentityProvider/Root',
  component: IdentityProviderRootView,
} as ComponentMeta<typeof IdentityProviderRootView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof IdentityProviderRootView> = () => {
  return <IdentityProviderRootView />;
};

export const Primary = Template.bind({});
