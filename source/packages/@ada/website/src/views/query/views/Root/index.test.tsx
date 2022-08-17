/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { LL } from '@ada/strings';
import { MockMetaProvider } from '$core/provider/mock';
import { QueryExecutionStatus } from '@ada/common';
import { QueryRootView } from '.';
import { act, fireEvent, render } from '@testing-library/react';

jest.mock('@ada/api-client');

const EXECUTION_ID = 'mock-id';

describe('QueryRootView', () => {
  it('should execute a query', async () => {
    API.postQuery.mockResolvedValue({
      executionId: EXECUTION_ID,
    });
    API.getQueryStatus.mockResolvedValue({
      status: QueryExecutionStatus.SUCCEEDED,
    });
    API.listQueryResults.mockResolvedValue({
      columns: [
        {
          name: 'name',
          label: 'name',
        },
        {
          name: 'lightsaber',
          label: 'lightsaber',
        },
      ],
      data: [
        { name: 'Darth Vader', lightsaber: 'red' },
        { name: 'Obi Wan Kenobi', lightsaber: 'blue' },
      ],
    });

    const { findByText, findByTestId } = render(
      <MockMetaProvider>
        <QueryRootView />
      </MockMetaProvider>,
    );

    const sqlEditorInput = await findByTestId('sql-editor-input');
    await act(async () => {
      fireEvent.change(sqlEditorInput, { target: { value: 'SELECT * FROM mock' } });
    });

    const executeButton = await findByText(LL.VIEW.QUERY.ACTIONS.execute.text());
    await act(async () => {
      fireEvent.click(executeButton);
    });

    expect(await findByTestId('query-results')).toBeInTheDocument();

    expect(await findByText('lightsaber')).toBeInTheDocument();
    expect(await findByText('red')).toBeInTheDocument();
    expect(await findByText('blue')).toBeInTheDocument();
  });

  it('should show an error when we fail to execute a query', async () => {
    API.postQuery.mockResolvedValue({
      executionId: EXECUTION_ID,
    });
    API.getQueryStatus.mockResolvedValue({
      status: QueryExecutionStatus.FAILED,
    });
    API.listQueryResults.mockRejectedValue({
      message: 'Mock error message',
    });

    const { findByText, findAllByText } = render(
      <MockMetaProvider appLayout>
        <QueryRootView />
      </MockMetaProvider>,
    );
    const executeButton = await findByText(LL.VIEW.QUERY.ACTIONS.execute.text());

    await act(async () => {
      fireEvent.click(executeButton);
    });

    expect(await findAllByText(LL.VIEW.QUERY.STATUS.FAILED.label(), undefined, { timeout: 4000 })).toBeDefined();
  });
});
