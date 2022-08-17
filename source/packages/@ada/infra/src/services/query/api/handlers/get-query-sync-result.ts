/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { AthenaQueryExecutionState, StepFunctionExecutionStatus, isQueryExecuting, sleep } from '@ada/common';
import {
  ConsolidatedQueryExecutionStatus,
  buildExecutionError,
  getConsolidatedExecutionStatus,
} from '../../components/lambda';
import { QueryExecutionStepFunctionOutput } from '../../components/step-functions';
import { StatusCodes } from 'http-status-codes';
import { getQueryResults } from '../../components/athena';

// the combination of these two must not exceed 30s
// leave a bit of buffer for the execution of getQueryResults
export const MAX_REQUESTS = 13;

export const MAX_TIMEOUT_SECOND = 2;

export const calculateTimeout = () => MAX_TIMEOUT_SECOND * 1000;

export const isFinalState = ({ stepFunctionStatus, athenaState }: ConsolidatedQueryExecutionStatus): boolean =>
  !isQueryExecuting(athenaState || stepFunctionStatus);

/**
 * Handler for retrieving the query result synchronously
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getQuerySyncResult', async ({ requestParameters }, callingUser, event) => {
  const { executionId, retrieveDataIntegrity } = requestParameters;
  let executionCompleted = false;
  let currentRequest = 0;
  let lastConsolidatedStatus;

  do {
    lastConsolidatedStatus = await getConsolidatedExecutionStatus(executionId, callingUser);

    if ('statusCode' in lastConsolidatedStatus) {
      return lastConsolidatedStatus;
    }

    executionCompleted = isFinalState(lastConsolidatedStatus);
    currentRequest++;

    if (!executionCompleted) {
      // wait a few second before performing the next request
      // only if the execution has not been completed yet
      await sleep(calculateTimeout());
    }
  } while (!(currentRequest === MAX_REQUESTS || executionCompleted));

  // if the execution has not completed yet, will send a redirect response
  if (!executionCompleted) {
    return ApiResponse.respondWithHeaders(
      StatusCodes.SEE_OTHER,
      { message: 'Execution not yet completed, please follow redirect for results' },
      {
        location: `/${event.requestContext.stage}/query/sync/${executionId}/result`,
      },
    );
  }

  // if the execution has not been completed successfully, then we'll send an error
  if (
    lastConsolidatedStatus.stepFunctionStatus !== StepFunctionExecutionStatus.SUCCEEDED ||
    lastConsolidatedStatus.athenaState !== AthenaQueryExecutionState.SUCCEEDED
  ) {
    return ApiResponse.badRequest(buildExecutionError(lastConsolidatedStatus.stepFunctionExecutionOutput));
  }

  const paginationParameters = getPaginationParameters(requestParameters);

  // return the results to the client
  return ApiResponse.success(
    await getQueryResults(
      lastConsolidatedStatus.stepFunctionExecutionOutput! as QueryExecutionStepFunctionOutput,
      paginationParameters,
      !!retrieveDataIntegrity,
    ),
  );
});
