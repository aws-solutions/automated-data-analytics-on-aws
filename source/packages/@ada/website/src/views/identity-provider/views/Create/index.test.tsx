/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { LL } from '@ada/strings';
import { composeStories } from '@storybook/testing-react';
import { render } from '@testing-library/react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe('views/identity-provider/create', () => {
  it('primary', async () => {
    const { container, findAllByText } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();

    expect(await findAllByText(LL.ENTITY.IdentityProvider__CREATE())).toBeDefined();
  });
});
