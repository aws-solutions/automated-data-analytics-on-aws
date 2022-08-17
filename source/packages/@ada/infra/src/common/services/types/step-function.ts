/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Interface for a step function lambda event
 */
export interface StepFunctionLambdaEvent<T> {
  readonly Payload: T;
}

export interface StepFunctionLambdaLogEvent<T> extends StepFunctionLambdaEvent<T> {
  readonly Execution: StepFunctionExecutionContext;
}

export interface StepFunctionExecutionContext {
  Id: string;
  Input: any;
  StartTime: string;
}

/**
 * Error details from a step function
 */
export interface StepFunctionErrorDetails {
  readonly Error: string;
  readonly Cause: string;
}

/**
 * Return the specific error message from the error cause if possible, otherwise the error type
 * @param errorDetails error details from stepfunction step failure
 */
export const buildErrorMessageFromStepFunctionErrorDetails = (errorDetails: StepFunctionErrorDetails): string => {
  try {
    const cause = JSON.parse(errorDetails.Cause);
    const message = cause.errorMessage || cause.ErrorMessage;

    return errorDetails.Error.concat(message ? ': '.concat(message) : '');
  } catch (e) {
    console.error('Failed to parse error cause', errorDetails, e);
    return errorDetails.Error;
  }
};
