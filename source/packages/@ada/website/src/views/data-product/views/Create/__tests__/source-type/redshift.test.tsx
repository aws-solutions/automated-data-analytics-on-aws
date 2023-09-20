/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import * as stories from './redshift.stories';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, RedshiftCluster, InputError } = composeStories(stories);

describe(`CreateDataProductView/${Connectors.AmazonRedshift.ID}`, () => {
  describe('storybook', () => {
    it(`working - ${Connectors.AmazonRedshift.ID}`, async () => {
      const screen = render(<Primary {...(Primary.args as any)} />);

      await Primary.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });

    it(`working - ${Connectors.AmazonRedshift.ID} - Redshift Cluster`, async () => {
      const screen = render(<RedshiftCluster {...(RedshiftCluster.args as any)} />);

      await RedshiftCluster.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });

    it(`input error - ${Connectors.AmazonRedshift.ID}`, async () => {
      const screen = render(<InputError {...(InputError.args as any)} />);

      await InputError.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });
  });
});
