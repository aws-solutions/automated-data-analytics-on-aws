/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { LL } from '@ada/strings';
import { act, render, screen, waitFor } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { delay } from '$common/utils';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, Coverage, DeleteSavedQueries } = composeStories(stories);
describe('QueryWorkBench', () => {
  it('primary', async () => {
    API.listApiAccessPolicies.mockResolvedValue({
      policies: [{ apiAccessPolicyId: 'read-only', name: 'Read Only', resources: ['read*'] }],
    });

    const { findAllByText, container } = render(<Primary {...(Primary.args as any)} />);
    expect(container).toBeDefined();
    await act(async () => {
      await Primary.play({ canvasElement: container });
    });
    expect((await findAllByText(LL.VIEW.QUERY.title())).length).toBeGreaterThan(0);
    expect((await findAllByText(LL.VIEW.QUERY.subtitle())).length).toBeGreaterThan(0);
    expect((await findAllByText(LL.VIEW.QUERY.RESULTS.title())).length).toBeGreaterThan(0);
    expect((await findAllByText(LL.VIEW.QUERY.RESULTS.emptyText())).length).toBeGreaterThan(0);
  });

  it('coverage', async () => {
    const { container } = render(<Coverage {...(Coverage.args as any)} />);
    expect(container).toBeDefined();
    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    await waitFor(async () => {
      return expect((await screen.findAllByText(LL.VIEW.QUERY.ACTIONS.save.text())).length).toBeGreaterThan(0);
    });
  });
  it.skip('deleteSavedQueries', async () => {
    const { container } = render(<DeleteSavedQueries {...(DeleteSavedQueries.args as any)} />);
    expect(container).toBeDefined();
    await act(async () => {
      await DeleteSavedQueries.play({ canvasElement: container });
    });

    await act(async () => {
      await delay(100);
    });

    await waitFor(async () => {
      return expect((await screen.findAllByText(LL.ENTITY.SavedQuery__DELETED('test'))).length).toBeGreaterThan(0);
    });
  });
});
