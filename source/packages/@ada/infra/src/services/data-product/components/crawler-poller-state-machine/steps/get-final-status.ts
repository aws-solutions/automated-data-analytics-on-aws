/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance, Glue } from '@ada/aws-sdk';
import { GetCrawlerStatusRequest, GetCrawlerStatusResult } from './get-status';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';

export interface GetCrawlerFinalStatusResult extends GetCrawlerStatusResult {
  readonly error: string;
}

const glue = AwsGlueInstance();
/**
 * Handler for getting the final status of a crawl
 * @param event api gateway request
 * @param context lambda context
 */

export const handler = async (
  event: StepFunctionLambdaEvent<GetCrawlerStatusRequest>,
  _context: any,
): Promise<GetCrawlerFinalStatusResult> => {
  const { crawlerName } = event.Payload;
  const log = Logger.getLogger();
  const params: Glue.GetCrawlerRequest = {
    Name: crawlerName,
  };

  const crawler = await glue.getCrawler(params).promise();

  log.info(`GetCrawler`, { crawler });

  const status = crawler.Crawler?.LastCrawl?.Status;

  let errorMessage = '';
  if (status === 'FAILED' && crawler.Crawler?.LastCrawl?.ErrorMessage) {
    errorMessage = crawler.Crawler?.LastCrawl?.ErrorMessage;
    log.warn(`Crawler has failed status`, { errorMessage, status });
  }
  return { ...event.Payload, status: status || '', error: errorMessage };
};
