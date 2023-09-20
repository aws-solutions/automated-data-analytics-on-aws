/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceFailedResponse,
  CloudFormationCustomResourceSuccessResponse,
} from 'aws-lambda';
import { sendAnonymousMetric } from '../../utils/metrics';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export async function handler(
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceSuccessResponse | CloudFormationCustomResourceFailedResponse> {
  // Hard code the CloudFormation status to be SUCCESS to let the CloudFormation
  // provisioning continue when metrics collection lambda hits issues
  const cfnResponseStatus = 'SUCCESS';
  const { awsSolutionId, awsSolutionVersion, awsRegion, sendAnonymousData } = event.ResourceProperties;
  let anonymousDataUUID = '';

  switch (event.RequestType) {
    case 'Create':
      // only create anonymized uuid for create event
      anonymousDataUUID = uuidv4();
      break;

    case 'Update':
    case 'Delete':
      anonymousDataUUID = event.PhysicalResourceId;
      break;
  }

  // send anonymized metrics data
  const result = await sendAnonymousMetric({
    awsSolutionId,
    awsSolutionVersion,
    anonymousDataUUID,
    timestamp: moment.utc().format('YYYY-MM-DD HH:mm:ss.S'),
    data: {
      region: awsRegion,
      requestType: event.RequestType,
      sendAnonymousData,
    },
  });

  return {
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId: anonymousDataUUID,
    Data: {
      anonymousDataUUID,
      sendAnonymousData,
    },
    StackId: event.StackId,
    Status: cfnResponseStatus,
    Reason: result,
  };
}
