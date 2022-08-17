/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, Autocompletion } = composeStories(stories);
describe('QueryWorkBench/QueryEditor', () => {
  it('primary', async () => {
    const { container } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();
  });

  // This works in storybook but not in jest test - so skipping
  // Issue with getting completions to render in the jest dom
  it.skip('Autocompletion', async () => {
    const { container } = render(<Autocompletion {...(Autocompletion.args as any)} />);
    expect(container).toBeDefined();
    await act(async () => {
      await Autocompletion.play({ canvasElement: container });
    });
  });
});
