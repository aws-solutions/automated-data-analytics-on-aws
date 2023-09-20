/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import * as stories from './dynamodb.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);
jest.mock('@ada/api-client-lambda');
jest.mock('@ada/api-client');

const { Primary, InputError, PrimaryCrossAccount } = composeStories(stories);

const tableStreamARN = 'arn:aws:dynamodb:us-west-2:11111111111:table/1-test-data/stream/foo';

describe(`CreateDataProductView/${Connectors.AmazonDynamoDB.ID}`, () => {
  describe('storybook same account', () => {
    beforeEach(() => {
      API.getDataProductDynamoDBTableStream.mockResolvedValue({
        crossAccount: false,
        tableStreamArn: tableStreamARN,
        streamEnabled: true,
        streamViewType: 'NEW_AND_OLD_IMAGES',
      });
    });

    it(`happy path - ${Connectors.AmazonDynamoDB.ID}`, async () => {
      const screen = render(<Primary {...(Primary.args as any)} />);

      await Primary.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });
  });

  describe('storybook cross account', () => {
    beforeEach(() => {
      API.getDataProductDynamoDBTableStream.mockResolvedValue({
        crossAccount: true,
      });
    });

    it(`happy path - ${Connectors.AmazonDynamoDB.ID}`, async () => {
      const screen = render(<Primary {...(Primary.args as any)} />);

      await PrimaryCrossAccount.play({ canvasElement: screen.container });

      expect(screen.container).toBeDefined();
    });

    it(`input error - ${Connectors.AmazonDynamoDB.ID}`, async () => {
      const { container } = render(<InputError {...(InputError.args as any)} />);

      await InputError.play({ canvasElement: container });

      expect(container).toBeDefined();
    });
  });
});
