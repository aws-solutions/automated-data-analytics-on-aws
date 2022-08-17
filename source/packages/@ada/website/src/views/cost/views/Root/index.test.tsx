/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { act, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, Coverage } = composeStories(stories);

describe('views/cost/root', () => {
  it('primary', async () => {
    const { container } = render(<Primary {...(Primary.args as any)} />);
    expect(container).toBeDefined();
  });
  it('coverage', async () => {
    const { container } = render(<Coverage {...(Coverage.args as any)} />);
    expect(container).toBeDefined();
    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    expect(await screen.findByText('Account Costs')).toBeInTheDocument();
    expect(await screen.findByText('Service Costs')).toBeInTheDocument();
    expect(await screen.findByText('Most Used Service')).toBeInTheDocument();
    expect(await screen.findAllByText('Total Cost')).toBeDefined();
    expect(await screen.findByText('Services Used')).toBeInTheDocument();
    expect(await screen.findByText('Most Costly Service')).toBeInTheDocument();
  });
});
