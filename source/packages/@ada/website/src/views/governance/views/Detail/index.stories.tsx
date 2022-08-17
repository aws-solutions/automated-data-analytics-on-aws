/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { OntologyDetailView } from './index';
import { getOntologyIdString } from '$common/utils';

const SYSTEM_ONTOLOGY = fixtures.ONTOLOGY_PII_LOCATION;

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Governance/Detail',
  component: OntologyDetailView,
} as ComponentMeta<typeof OntologyDetailView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof OntologyDetailView> = (args) => {
  return (
    <MemoryRouter initialEntries={[`/${getOntologyIdString(SYSTEM_ONTOLOGY)}`]}>
      <Route path="/:ontologyId">
        <OntologyDetailView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});
