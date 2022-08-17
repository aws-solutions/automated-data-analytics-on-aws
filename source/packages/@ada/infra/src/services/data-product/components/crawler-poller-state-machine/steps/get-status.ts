/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance, Glue } from '@ada/aws-sdk';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';

export interface GetCrawlerStatusRequest {
  readonly crawlerName: string;
}

export interface GetCrawlerStatusResult extends GetCrawlerStatusRequest {
  readonly status: string;
}

const glue = AwsGlueInstance();

/**
 * Handler for getting the state of the crawler
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GetCrawlerStatusRequest>,
  context: any,
): Promise<GetCrawlerStatusResult> => {
  const { crawlerName } = event.Payload;
  const log = Logger.getLogger({
    lambda: {
      event,
      context,
    },
  });

  const params: Glue.GetCrawlerRequest = {
    Name: crawlerName,
  };

  const crawler = await glue.getCrawler(params).promise();

  log.info(`GetCrawler `, { crawler });

  let status: string;
  switch (crawler.Crawler?.State) {
    case 'READY': {
      status = 'SUCCEEDED';
      break;
    }
    case 'RUNNING':
    case 'STOPPING': {
      status = crawler.Crawler?.State;
      break;
    }
    default: {
      status = 'FAILED';
      break;
    }
  }
  return { ...event.Payload, status: status };
};
