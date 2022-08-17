/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { LL } from '$strings';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);
jest.mock('@ada/api-client');

const { Primary, Submit } = composeStories(stories);

describe('views/user/components/dialog/CreateApiKeyDialog', () => {
  it('should render dialog', async () => {
    const { getByText } = render(<Primary {...(Primary.args as any)} />);

    expect(await getByText(LL.VIEW.USER.ApiKey.wizard.title())).toBeInTheDocument();
  });
  it('should create and display api key', async () => {
    const { container, findByText } = render(<Submit {...(Submit.args as any)} />);

    await act(async () => {
      await Submit.play({ canvasElement: container });
    });

    expect(await findByText('mock-auth-url')).toBeInTheDocument();
    expect(await findByText('mock-auth-token')).toBeInTheDocument();
  });
});
