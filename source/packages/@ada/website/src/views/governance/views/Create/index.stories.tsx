/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateOntologyView } from './index';
import { DELAY } from '$testing/interaction';
import { DefaultGroupIds, LensIds } from '@ada/common';
import { LL } from '$strings';
import { MemoryRouter, Route } from 'react-router-dom';
import { NONE_LENS_OPTION } from '$common/entity/ontology';
import { PutOntologyRequest } from '@ada/api';
import { act, waitFor } from '@testing-library/react';
import { autoSuggestOptionEvent, selectOptionEvent } from '$testing/user-event';
import { delay } from '$common/utils';
import { findSQLEditor } from '$testing/sql-editor';
import { groupDisplayName } from '$common/entity/group/utils';
import { pick } from 'lodash';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';

const NEW_ONTOLOGY = fixtures.ONTOLOGY_NEW;

const GOVERNANCE_MAP: [groupId: DefaultGroupIds, column: string | undefined, row: string | undefined][] = [
  [DefaultGroupIds.DEFAULT, undefined, 'foo > 5'],
  [DefaultGroupIds.POWER_USER, LensIds.HASHED, `bar!='foo'`],
  [DefaultGroupIds.ADMIN, LensIds.CLEAR, undefined],
]

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Governance/Create',
  component: CreateOntologyView,
} as ComponentMeta<typeof CreateOntologyView>;

const Template: ComponentStory<typeof CreateOntologyView> = (args) => {
  useImmediateEffect(() => {
    API.putOntology.mockResolvedValue(NEW_ONTOLOGY);
  })

  return (
    <MemoryRouter initialEntries={[`/governance/new`]}>
      <Route path="/governance/new">
        <CreateOntologyView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const { getByText, getByLabelText } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });

  const namespaceInput = getByLabelText(LL.ENTITY['Ontology@'].namespace.label());
  await act(async () => {
    userEvent.clear(namespaceInput);
  })
  await act(async () => {
    await userEvent.type(namespaceInput, NEW_ONTOLOGY.ontologyNamespace, { delay: DELAY.TYPING });
  })

  await act(async () => {
    const input = getByLabelText(LL.ENTITY['Ontology@'].name.label());
    await userEvent.type(input, NEW_ONTOLOGY.name, { delay: DELAY.TYPING });
  })

  await act(async () => {
    const input = getByLabelText(LL.ENTITY['Ontology@'].description.label());
    await userEvent.type(input, NEW_ONTOLOGY.description, { delay: DELAY.TYPING });
  })

  const addAliasButton = getByText('Add new item');
  for (let i=0; i<NEW_ONTOLOGY.aliases.length; i++) {
    const alias = NEW_ONTOLOGY.aliases[i];
    await act(async () => {
      userEvent.click(addAliasButton);
    })
    await act(async () => {
      await delay(DELAY.IMMEDIATE);
    })
    await act(async () => {
      const input = canvasElement.querySelector(`[id="aliases[${i}].name"]`) as HTMLInputElement;
      await userEvent.type(input, alias.name, { delay: DELAY.TYPING });
    })
  }

  await act(async () => {
    userEvent.click(getByText('Next'));
  });

  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await selectOptionEvent(canvasElement, LL.ENTITY['Ontology@'].defaultLens.label(), NEW_ONTOLOGY.defaultLens);

  for (const [groupId, column, row] of GOVERNANCE_MAP) {
    await addGroupPolicy(canvasElement, groupId);
    column && await editGroupColumnPolicy(canvasElement, groupId, column);
    row && await editGroupRowPolicy(canvasElement, groupId, row);
  }

  await act(async () => {
    await delay(DELAY.IMMEDIATE);
  });

  await act(async () => {
    userEvent.click(getByText('Submit'));
  });

  await waitFor(() => {
    expect(API.putOntology).toBeCalledWith({
      ontologyNamespace: NEW_ONTOLOGY.ontologyNamespace,
      ontologyId: NEW_ONTOLOGY.ontologyId,
      ontologyInput: pick(NEW_ONTOLOGY, ['aliases', 'defaultLens', 'description', 'name']),
    } as PutOntologyRequest, undefined);

    expect(API.putGovernancePolicyAttributes).toBeCalledTimes(1);
    expect(API.putGovernancePolicyAttributeValues).toBeCalledTimes(1);
  })
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
    await sqlEditor.setValue(value);
    await delay(10);
  });

  await act(async () => {
    await delay(10);
  });
}
