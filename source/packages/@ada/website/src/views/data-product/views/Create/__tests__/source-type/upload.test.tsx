/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './s3.stories';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import * as Connectors from '@ada/connectors';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe(`CreateDataProductView/${Connectors.FileUpload.ID}`, () => {
  describe('storybook', () => {
    it(Connectors.FileUpload.ID, async () => {
      const { container } = render(<Primary {...(Primary.args as any)} />);

      await act(async () => {
        await Primary.play({ canvasElement: container });
      });

      expect(container).toBeDefined();
    });
  });
});
