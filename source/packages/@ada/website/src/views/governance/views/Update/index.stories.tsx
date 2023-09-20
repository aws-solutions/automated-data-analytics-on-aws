/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DELAY } from '$testing/interaction';
import { DefaultGroupIds, LensIds } from '@ada/common';
import { LL } from '$strings';
import { MemoryRouter, Route } from 'react-router-dom';
import { NONE_LENS_OPTION } from '$common/entity/ontology';
import { UpdateOntologyView } from './index';
import { act } from '@testing-library/react';
import { autoSuggestOptionEvent, selectOptionEvent } from '$testing/user-event';
import { delay, getOntologyIdString } from '$common/utils';
import { findSQLEditor } from '$testing/sql-editor';
import { groupDisplayName } from '$common/entity/group/utils';
import { userEvent, within } from '@storybook/testing-library';

const SYSTEM_ONTOLOGY = fixtures.ONTOLOGY_PII_LOCATION;
const CUSTOM_ONTOLOGY = fixtures.ONTOLOGY_CUSTOM_NAME;

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Governance/Update',
  component: UpdateOntologyView,
  parameters: {
    ontologyId: getOntologyIdString(CUSTOM_ONTOLOGY),
  },
} as ComponentMeta<typeof UpdateOntologyView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof UpdateOntologyView> = (args, context) => {
  return (
    <MemoryRouter initialEntries={[`/governance/${context.parameters.ontologyId}/edit`]}>
      <Route path="/governance/:ontologyId">
        <UpdateOntologyView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const System = Template.bind({});

System.parameters = {
  ontologyId: getOntologyIdString(SYSTEM_ONTOLOGY),
};

export const Coverage = Template.bind({});

const GOVERNANCE_MAP: [groupId: DefaultGroupIds, column: string | undefined, row: string | undefined][] = [
  [DefaultGroupIds.DEFAULT, undefined, 'foo > 5'],
  [DefaultGroupIds.POWER_USER, LensIds.CLEAR, undefined],
  [DefaultGroupIds.ADMIN, LensIds.CLEAR, undefined],
]

Coverage.play = async ({ canvasElement }) => {
  const { getByText, getByLabelText } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await userEvent.type(getByLabelText('Description'), 'Updated description', { delay: 2 });

  await act(async () => {
    userEvent.click(getByText('Next'));
  });

  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await selectOptionEvent(canvasElement, LL.ENTITY['Ontology@'].defaultLens.label(), LensIds.HASHED);

  for (const [groupId, column, row] of GOVERNANCE_MAP) {
    await addGroupPolicy(canvasElement, groupId);
    await editGroupColumnPolicy(canvasElement, groupId, column);
    await editGroupRowPolicy(canvasElement, groupId, row);
  }

  await act(async () => {
    await delay(DELAY.IMMEDIATE);
  });

  await act(async () => {
    userEvent.click(getByText('Submit'));
  });
};

async function addGroupPolicy(canvasElement: HTMLElement, groupId: string) {
  const { getByText, getByTestId } = within(canvasElement);

  await autoSuggestOptionEvent(getByTestId('search-custom-group'), LL.VIEW.GOVERNANCE.actions.searchGroups(), groupDisplayName(groupId));

  await delay(DELAY.SHORT);

  await act(async () => {
    userEvent.click(getByText('Add Governance Settings'));
  });

  await delay(DELAY.SHORT);
}

async function editGroupColumnPolicy(canvasElement: HTMLElement, groupId: string, value?: string) {
  const { getByText } = within(canvasElement);
  const groupContainer: HTMLElement = (getByText(groupDisplayName(groupId))).closest('.MuiBox-root')!;
  await selectOptionEvent(groupContainer, LL.ENTITY.AttributePolicy(), value || NONE_LENS_OPTION.value!);
}

async function editGroupRowPolicy(canvasElement: HTMLElement, groupId: string, value?: string) {
  const { getByText } = within(canvasElement);
  const groupContainer: HTMLElement = (getByText(groupDisplayName(groupId))).closest('.MuiBox-root')!;
  const sqlEditor = await findSQLEditor(groupContainer);

  await act(async () => {
    await sqlEditor.setValue(value || '');
    await delay(10);
  });

  await act(async () => {
    await delay(10);
  });
}
