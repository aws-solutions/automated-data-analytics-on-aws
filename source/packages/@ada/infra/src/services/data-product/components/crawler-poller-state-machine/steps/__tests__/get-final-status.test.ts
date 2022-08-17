/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { GetCrawlerFinalStatusResult, handler } from '../get-final-status';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetCrawler = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsGlueInstance: jest.fn().mockImplementation(() => ({
    getCrawler: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetCrawler(...args))),
    }),
  })),
}));

describe('get-final-status', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should return a crawlers status ', async () => {
    const crawler = {
      Crawler: {
        Name: 'start_crawler-myfirst-dp-id',
        State: 'READY',
        LastCrawl: {
          Status: 'SUCCEEDED',
        },
      },
    };
    mockGetCrawler.mockReturnValue(crawler);
    const response = await handler(
      {
        Payload: {
          crawlerName: 'start_crawler-myfirst-dp-id',
        },
      },
      null,
    );
    const getCrawlerFinalStatusResult: GetCrawlerFinalStatusResult = {
      crawlerName: 'start_crawler-myfirst-dp-id',
      status: 'SUCCEEDED',
      error: '',
    };

    expect(response).toEqual(getCrawlerFinalStatusResult);
    expect(mockGetCrawler).toHaveBeenCalledWith({
      Name: 'start_crawler-myfirst-dp-id',
    });
  });
  it('should return a crawlers error message if crawler state is FAILED ', async () => {
    const crawler = {
      Crawler: {
        Name: 'start_crawler-myfirst-dp-id',
        State: 'READY',
        LastCrawl: {
          Status: 'FAILED',
          ErrorMessage: 'crawl failed',
        },
      },
    };
    mockGetCrawler.mockReturnValue(crawler);
    const response = await handler(
      {
        Payload: {
          crawlerName: 'start_crawler-myfirst-dp-id',
        },
      },
      null,
    );
    const getCrawlerFinalStatusResult: GetCrawlerFinalStatusResult = {
      crawlerName: 'start_crawler-myfirst-dp-id',
      status: 'FAILED',
      error: 'crawl failed',
    };

    expect(response).toEqual(getCrawlerFinalStatusResult);
    expect(mockGetCrawler).toHaveBeenCalledWith({
      Name: 'start_crawler-myfirst-dp-id',
    });
  });
});
