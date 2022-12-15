/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { AwsKinesisInstance, Kinesis } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import { METRICS_EVENT_TYPE, OperationalMetricsClient } from '../../../../api/components/operational-metrics/client';
import { Query } from '@ada/api';
import { StepFunctionLambdaLogEvent } from '../../../../../common/services';

export interface LogQueryExecutionEvent extends Query {
  callingUser: CallingUser;
  originalQuery: string;
  queryExecutionId: string;
  athenaStatus: any;
  createdTimestamp: string;
  updatedTimestamp: string;
}

const { KINESIS_STREAM_NAME } = process.env;

const kinesis = AwsKinesisInstance();
/**
 * Handler for starting a new Athena query execution
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaLogEvent<LogQueryExecutionEvent>,
  _context: any,
): Promise<any> => {
  // NOTE: consider encrypting messages
  const { query, callingUser, originalQuery, queryExecutionId, athenaStatus } = event.Payload;

  const executionContext = event.Execution;
  const exeuctionId = executionContext.Id;
  const input = executionContext.Input;
  const startTime = executionContext.StartTime;
  const endTime = new Date().toISOString();

  const params: Kinesis.PutRecordInput = {
    StreamName: KINESIS_STREAM_NAME ?? '',
    PartitionKey: exeuctionId,
    Data: JSON.stringify({
      exeuctionId,
      originalQuery: originalQuery || input.query, // if errors we can retrieve original query from statemachine input
      athenaQuery: query,
      callingUser,
      queryExecutionId,
      athenaStatus,
      executionStartTime: startTime,
      exeuctionEndTime: endTime,
    }),
  };

  try {
    await kinesis.putRecord(params).promise();

    await OperationalMetricsClient.getInstance().send({
      event: METRICS_EVENT_TYPE.QUERY_EXECUTED,
    });
  } catch (e) {
    console.error(e);
  }
  return {
    ...event.Payload,
  };
};
