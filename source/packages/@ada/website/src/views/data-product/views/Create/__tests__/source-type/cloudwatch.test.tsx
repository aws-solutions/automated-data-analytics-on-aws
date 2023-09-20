/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import * as stories from './cloudwatch.stories';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, InputError } = composeStories(stories);

describe(`CreateDataProductView/${Connectors.AmazonCloudWatch.ID}`, () => {
  describe('storybook', () => {
    it(`working - ${Connectors.AmazonCloudWatch.ID}`, async () => {
      const screen = render(<Primary {...(Primary.args as any)} />);

      await Primary.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });

    it(`input error - ${Connectors.AmazonCloudWatch.ID}`, async () => {
      const { container } = render(<InputError {...(InputError.args as any)} />);

      await InputError.play({ canvasElement: container });

      expect(container).toBeDefined();
    });
  });
});
