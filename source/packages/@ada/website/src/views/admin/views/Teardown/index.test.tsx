/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { LL } from '$strings';
import { TEARDOWN_DETAILS } from './index.stories';
import { TearDownDetails } from '@ada/api';
import { act, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

const { Primary, Coverage } = composeStories(stories);

jest.mock('@ada/api-client');

describe('TeardownView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show teardown page', async () => {
    await act(async () => {
      const { container } = render(<Primary {...(Primary.args as any)} />);
      expect(container).toBeDefined();

      await act(async () => {
        await Primary.play({ canvasElement: container });
      });

      expect((await screen.findAllByText(LL.VIEW.ADMIN.Teardown.title())).length).toBeGreaterThan(0);
      expect((await screen.findAllByText(LL.VIEW.ADMIN.Teardown.strategy.retainData.heading())).length).toBeGreaterThan(
        0,
      );

      expect(await screen.findByText(LL.VIEW.ADMIN.Teardown.strategy.retainData.buttonText())).toBeInTheDocument();
      expect(await screen.findByText(LL.VIEW.ADMIN.Teardown.strategy.destroyData.buttonText())).toBeInTheDocument();
    });
  });

  it('coverage', async () => {
    const clipboardContents: TearDownDetails & { stackLink: string } = {
      ...TEARDOWN_DETAILS,
      stackLink:
        'https://undefined.console.aws.amazon.com/cloudformation/home?region=undefined#/stacks/outputs?&stackId=Stack23452dsf',
    };
    const mockWriteText = jest.fn().mockResolvedValueOnce(clipboardContents);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
    });
    const { container } = render(<Coverage {...(Coverage.args as any)} />);
    expect(container).toBeDefined();

    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    expect(await screen.findByText(LL.VIEW.ADMIN.Teardown.notify.success.header())).toBeInTheDocument();
    expect(await screen.findByText(LL.VIEW.ADMIN.Teardown.success.heading())).toBeInTheDocument();
    expect(await screen.findByText(LL.VIEW.notify.brief.clipboard.success())).toBeInTheDocument();

    expect(navigator.clipboard.writeText).toBeCalledTimes(1);
  });
});
