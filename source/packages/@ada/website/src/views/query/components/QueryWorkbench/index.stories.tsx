/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { LL } from '@ada/strings';
import { QueryWorkbench } from './index';
import { SavedQuery } from '@ada/api';
import { act, screen } from '@testing-library/react';
import { applyQueryExecutionApiMocks } from '$testing/api';
import { delay } from '$common/utils';
import { findSQLEditor } from '$testing/sql-editor';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/QueryWorkbench/Root',
  component: QueryWorkbench,
  args: {},
} as ComponentMeta<typeof QueryWorkbench>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof QueryWorkbench> = (args) => {
  useImmediateEffect(() => {
    API.listQueryNamespaceSavedQueries.mockResolvedValue({ queries: [SAVED_PRIVATE_QUERY] });
    API.listQuerySavedQueries.mockResolvedValue({
      queries: [],
    });

    API.putQuerySavedQuery.mockImplementation(({ queryId, savedQueryInput, namespace }) => {
      return Promise.resolve({ queryId, ...savedQueryInput, namespace });
    });

    applyQueryExecutionApiMocks('delayed');
  });

  return <QueryWorkbench {...args} />;
};

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const DeleteQueryTemplate: ComponentStory<typeof QueryWorkbench> = (args) => {
  useImmediateEffect(() => {
    API.listQueryNamespaceSavedQueries.mockResolvedValue({ queries: [SAVED_PRIVATE_QUERY] });
    API.listQuerySavedQueries.mockResolvedValue({
      queries: [],
    });

    API.deleteQuerySavedQuery.mockImplementation(() => {
      API.listQuerySavedQueries.mockResolvedValue({
        queries: [],
      });
      API.listQueryNamespaceSavedQueries.mockResolvedValue({ queries: [] });
      return Promise.resolve({} as SavedQuery);
    });

    API.putQuerySavedQuery.mockImplementation(({ queryId, savedQueryInput, namespace }) => {
      return Promise.resolve({ queryId, ...savedQueryInput, namespace });
    });
  });

  return <QueryWorkbench {...args} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // opening save dialog
  await act(async () => {
    await delay(10);
    userEvent.click(canvas.getByText('Save'));
  });
  // interaction with save dialog
  await act(async () => {
    await delay(10);
    await userEvent.type(canvas.getByLabelText(LL.ENTITY['SavedQuery@'].name.label()), 'TestSaveQuery', { delay: 10 });
  });

  await act(async () => {
    await delay(10);
  });

  await act(async () => {
    await delay(10);
    await userEvent.type(
      canvas.getByLabelText(LL.ENTITY['SavedQuery@'].description.label()),
      'Test description of saved query',
      { delay: 10 }
    );
  });

  await act(async () => {
    await delay(10);
    userEvent.click(canvas.getByText('Submit'));
  });

  const sqlEditor = await findSQLEditor(canvasElement);

  await sqlEditor.append('test');

  await delay(10);

  await act(async () => {
    userEvent.click(canvas.getByText(LL.VIEW.QUERY.ACTIONS.execute.text()));
  });
};

export const DeleteSavedQueries = DeleteQueryTemplate.bind({});

DeleteSavedQueries.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    await delay(100);
  });

  await act(async () => {
    await delay(10);
    const hamburger = canvas.getByLabelText('hamburger');
    userEvent.click(hamburger);
  });

  await act(async () => {
    await delay(10);
    const deleteBtn = await screen.findAllByText('Delete');
    userEvent.click(deleteBtn[0]);
  });

  await act(async () => {
    await delay(10);
    userEvent.type(await canvas.getByPlaceholderText('delete'), 'delete');
  });

  await act(async () => {
    await delay(10);
  });

  await act(async () => {
    userEvent.click(await canvas.findByText('Delete'));
  });
};

const DEFAULT_USER = 'test-user';
const PRIVATE_QUERY_ID = {
  namespace: DEFAULT_USER,
  queryId: 'test',
};
const SAVED_PRIVATE_QUERY: SavedQuery = {
  ...PRIVATE_QUERY_ID,
  addressedAs: 'my.queries.test',
  type: 'PRIVATE',
  query: 'select * from foo',
  referencedDataSets: [],
  referencedQueries: [],
};
