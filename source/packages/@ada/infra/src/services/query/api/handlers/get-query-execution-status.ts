/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AthenaQueryExecutionState, StepFunctionExecutionStatus } from '@ada/common';
import { QueryStatus } from '@ada/api';
import { buildExecutionError, getConsolidatedExecutionStatus } from '../../components/lambda';

/**
 * Handler for retrieving the status of a previous execution
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getQueryStatus',
  async ({ requestParameters }, callingUser, _event, { log }) => {
    const { executionId } = requestParameters;
    const consolidatedStatus = await getConsolidatedExecutionStatus(executionId, callingUser);
    log.info(`consolidatedStatus: ${JSON.stringify(consolidatedStatus)}`);

    if ('statusCode' in consolidatedStatus) {
      return consolidatedStatus;
    }

    if (consolidatedStatus.stepFunctionStatus !== StepFunctionExecutionStatus.SUCCEEDED) {
      return ApiResponse.success(<QueryStatus>{
        status: consolidatedStatus.stepFunctionStatus,
        reason: buildExecutionError(consolidatedStatus.stepFunctionExecutionOutput).details,
      });
    }

    return ApiResponse.success(<QueryStatus>{
      status: consolidatedStatus.athenaState as string,
      reason:
        consolidatedStatus.athenaState !== AthenaQueryExecutionState.SUCCEEDED
          ? buildExecutionError(consolidatedStatus.stepFunctionExecutionOutput).details
          : undefined,
    });
  },
);
