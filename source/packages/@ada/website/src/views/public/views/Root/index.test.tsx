/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { LL } from '@ada/strings';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('aws-amplify');
jest.mock('@ada/api-client');

const { Primary, Coverage } = composeStories(stories);

describe('Views/Public/Root', () => {
  describe('storybook', () => {
    it('Primary', async () => {
      const { getByText } = render(<Primary {...(Primary.args as any)} />);

      expect(getByText(LL.VIEW.PUBLIC.Landing.title())).toBeInTheDocument();
    });
    it('Coverage', async () => {
      const { container } = render(<Coverage {...(Coverage.args as any)} />);

      await act(async () => {
        Coverage.play({ canvasElement: container });
      });
    });
  })
});
