/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { StartCrawlerEvent, handler } from '../start-crawler';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStartCrawler = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsGlueInstance: jest.fn().mockImplementation(() => ({
    startCrawler: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartCrawler(...args))),
    }),
  })),
}));

describe('start-crawler', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should return the crawler name  ', async () => {
    mockStartCrawler.mockReturnValue('');
    const response = await handler(
      {
        Payload: {
          crawlerName: 'start_crawler-myfirst-dp-id',
        },
      },
      null,
    );
    const getCrawlerFinalStatusResult: StartCrawlerEvent = {
      crawlerName: 'start_crawler-myfirst-dp-id',
    };

    expect(response).toEqual(getCrawlerFinalStatusResult);
    expect(mockStartCrawler).toHaveBeenCalledWith({
      Name: 'start_crawler-myfirst-dp-id',
    });
  });
});
