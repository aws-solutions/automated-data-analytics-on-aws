/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import * as stories from './mongodb.stories';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe(`CreateDataProductView/${Connectors.MongoDB.ID}`, () => {
  describe('storybook', () => {
    it(`working - ${Connectors.MongoDB.ID}`, async () => {
      const screen = render(<Primary {...(Primary.args as any)} />);

      await Primary.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });
  });
});
