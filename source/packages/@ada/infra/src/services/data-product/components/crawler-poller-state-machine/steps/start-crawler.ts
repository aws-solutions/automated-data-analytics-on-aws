/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance, Glue } from '@ada/aws-sdk';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';

export interface StartCrawlerEvent {
  readonly crawlerName: string;
}

const glue = AwsGlueInstance();

/**
 * Handler for starting a crawler
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<StartCrawlerEvent>,
  _context: any,
): Promise<StartCrawlerEvent> => {
  const { crawlerName } = event.Payload;

  const params: Glue.GetCrawlerRequest = {
    Name: crawlerName,
  };

  const data = await glue.startCrawler(params).promise();

  console.log({ data });

  return event.Payload;
};
