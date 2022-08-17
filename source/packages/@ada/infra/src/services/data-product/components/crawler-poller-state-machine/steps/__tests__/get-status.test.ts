/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { GetCrawlerStatusResult, handler } from '../get-status';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockGetCrawler = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsGlueInstance: jest.fn().mockImplementation(() => ({
    getCrawler: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetCrawler(...args))),
    }),
  })),
}));

describe('get-status', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  const cases = [
    ['READY', 'SUCCEEDED'],
    ['RUNNING', 'RUNNING'],
    ['UNKNOWN', 'FAILED'],
    ['STOPPING', 'STOPPING'],
  ];
  test.each(cases)('crawler state(%s) should return status %s', async (state, expectedStatus) => {
    const crawler = {
      Crawler: {
        Name: 'start_crawler-myfirst-dp-id',
        State: state,
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
    const getCrawlerFinalStatusResult: GetCrawlerStatusResult = {
      crawlerName: 'start_crawler-myfirst-dp-id',
      status: expectedStatus,
    };

    expect(response).toEqual(getCrawlerFinalStatusResult);
    expect(mockGetCrawler).toHaveBeenCalledWith({
      Name: 'start_crawler-myfirst-dp-id',
    });
  });
});
