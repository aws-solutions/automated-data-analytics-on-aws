/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { IdentityProviderDetailView } from './index';
import { MemoryRouter, Route } from 'react-router-dom';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/IdentityProvider/Detail',
  component: IdentityProviderDetailView,
  parameters: {
    notFound: false,
  },
} as ComponentMeta<typeof IdentityProviderDetailView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof IdentityProviderDetailView> = (args, context) => {
  const notFound = context.parameters.notFound === true;
  const id = notFound ? 'not_existing' : fixtures.IDENTITY_PROVIDER_OIDC.identityProviderId;

  return (
    <MemoryRouter initialEntries={[`/${id}`]}>
      <Route path="/:identityProviderId">
        <IdentityProviderDetailView />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const NotFound = Template.bind({});
NotFound.parameters = {
  notFound: true,
};
