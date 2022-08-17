/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { TEST_COGNITO_USER } from '$common/entity/user';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { delay } from '$common/utils';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe('Views/User/Root', () => {
  describe('storybook', () => {
    it('Primary', async () => {
      const { getByText } = render(<Primary {...(Primary.args as any)} />);

      await act(async () => {
        await delay(1000)
      })

      expect(getByText(TEST_COGNITO_USER.attributes!.email!)).toBeDefined();
    });
  })
});
