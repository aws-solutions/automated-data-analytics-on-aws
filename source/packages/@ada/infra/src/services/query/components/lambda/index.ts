/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { ApiError } from '@ada/api';
import { ApiResponse, isUserAllowed } from '@ada/api-gateway';
import { AthenaQueryExecutionState, CallingUser, StepFunctionExecutionStatus } from '@ada/common';
import { AwsStepFunctionsInstance } from '@ada/aws-sdk';
import {
  QueryExecutionStepFunctionInput,
  QueryExecutionStepFunctionOutput,
  QueryExecutionStepFunctionResult,
  getExecutionArnFromStateMachineArn,
} from '../step-functions';
import { StatusCodes } from 'http-status-codes';
import { StepFunctionErrorDetails, buildErrorMessageFromStepFunctionErrorDetails } from '@ada/microservice-common';

const stepFunction = AwsStepFunctionsInstance();

export interface ConsolidatedQueryExecutionStatus {
  stepFunctionStatus: StepFunctionExecutionStatus;
  athenaState?: AthenaQueryExecutionState;
  stepFunctionExecutionOutput?: QueryExecutionStepFunctionOutput | StepFunctionErrorDetails;
  stepFunctionExecutionInput: QueryExecutionStepFunctionInput;
}

export const buildExecutionError = (
  output?: QueryExecutionStepFunctionOutput | StepFunctionErrorDetails,
): ApiError => ({
  message: 'Failed to execute query',
  details:
    output &&
    ('athenaStatus' in output
      ? output.athenaStatus.QueryExecution.Status!.StateChangeReason
      : buildErrorMessageFromStepFunctionErrorDetails(output)),
});

/**
 * Helper method to be utilised to validate that the step function execution details are in the correct state
 * to perform subsequent actions (eg. retrieve the athena query results)
 * @param executionId the query execution id
 * @param callingUser the user validating the execution details
 * @returns input and output of the state machine if the state is successful, a ApiResponse error in case if not successfuly
 */
export const validateExecutionDetails = async (
  executionId: string,
  callingUser: CallingUser,
): Promise<QueryExecutionStepFunctionResult | ApiResponse<ApiError>> => {
  const consolidatedStatus = await getConsolidatedExecutionStatus(executionId, callingUser);
  console.log('consolidatedStatus: ', JSON.stringify(consolidatedStatus));

  if ('statusCode' in consolidatedStatus) {
    return consolidatedStatus;
  }

  const { stepFunctionStatus, athenaState, stepFunctionExecutionInput, stepFunctionExecutionOutput } =
    consolidatedStatus;

  if (
    stepFunctionStatus === StepFunctionExecutionStatus.RUNNING
    && consolidatedStatus.stepFunctionStatus === StepFunctionExecutionStatus.RUNNING
  ) {
    // Sometimes the frontend requests query results prior to completion which does not produce an error to return.
    // Adding deterministic error messaging to enable responding to this case.
    return ApiResponse.errorRespond(StatusCodes.CONFLICT, {
      name: 'QueryExecutionResultsNotReady',
      message: 'Query initialization in progress',
      details: `Query results are not available until after initialization has completed`,
    });
  }

  if (
    stepFunctionStatus !== StepFunctionExecutionStatus.SUCCEEDED ||
    (athenaState && athenaState !== AthenaQueryExecutionState.SUCCEEDED)
  ) {
    return ApiResponse.badRequest(buildExecutionError(stepFunctionExecutionOutput));
  }

  return {
    input: stepFunctionExecutionInput,
    output: stepFunctionExecutionOutput! as QueryExecutionStepFunctionOutput,
  };
};

/**
 * Retrieve a consolidated status between the step function workflow and the athena query execution
 * to be used for actions that need to perform logic on the retrieved status
 * @param executionId the query execution id
 * @param callingUser the user requesting the status
 * @returns the Step Function and Athena query execution status or an ApiResponse in case the user is not authorized to perform this action
 */
export const getConsolidatedExecutionStatus = async (
  executionId: string,
  callingUser: CallingUser,
): Promise<ConsolidatedQueryExecutionStatus | ApiResponse<ApiError>> => {
  const { userId: callerUserId } = callingUser;

  const stepFunctionExecution = await stepFunction
    .describeExecution({
      executionArn: `${getExecutionArnFromStateMachineArn(
        process.env.ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN!,
        executionId,
      )}`,
    })
    .promise();
  console.log(`Getting execution status from id: ${executionId}`);

  const input = JSON.parse(stepFunctionExecution.input!) as QueryExecutionStepFunctionInput;

  // Only the user that executed the query is allowed to retrieve the query results
  if (!isUserAllowed(callingUser, input.callingUser.userId, [])) {
    return ApiResponse.forbidden({
      message: `The user ${callerUserId} does not have the rights to perform this action`,
    });
  }

  // if the step function succeeded, verify the athena execution details to retrieve the state
  const output = stepFunctionExecution.output
    ? (JSON.parse(stepFunctionExecution.output) as QueryExecutionStepFunctionOutput | StepFunctionErrorDetails)
    : undefined;

  return {
    stepFunctionStatus:
      output && 'Error' in output
        ? StepFunctionExecutionStatus.FAILED
        : (stepFunctionExecution.status as StepFunctionExecutionStatus),
    athenaState:
      output && 'athenaStatus' in output
        ? (output.athenaStatus.QueryExecution.Status!.State! as AthenaQueryExecutionState)
        : undefined,
    stepFunctionExecutionOutput: output,
    stepFunctionExecutionInput: input,
  };
};

export const getDefaultDataSetId = (dataSetIds: string[]): string | undefined => {
  return dataSetIds.length === 1 ? dataSetIds[0] : undefined;
};
