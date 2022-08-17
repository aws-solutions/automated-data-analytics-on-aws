/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export enum StepFunctionExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT',
  ABORTED = 'ABORTED',
}

export enum AthenaQueryExecutionState {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Consolidated statuses for a query execution
 */
export const QueryExecutionStatus = { ...StepFunctionExecutionStatus, ...AthenaQueryExecutionState };

export type QueryExecutionStatus = StepFunctionExecutionStatus | AthenaQueryExecutionState; //NOSONAR export type

const EXECUTING_STATUSES: QueryExecutionStatus[] = [QueryExecutionStatus.RUNNING, QueryExecutionStatus.QUEUED];
const FAILED_STATUSES: QueryExecutionStatus[] = [
  QueryExecutionStatus.FAILED,
  QueryExecutionStatus.TIMED_OUT,
  QueryExecutionStatus.ABORTED,
  QueryExecutionStatus.CANCELLED,
];

/**
 * Return whether or not a query is still in progress
 * @param status the status to check
 */
export const isQueryExecuting = (status: QueryExecutionStatus) => EXECUTING_STATUSES.includes(status);

/**
 * Indicates if query is in failed state.
 * @param status the status to check
 */
export const hasQueryFailed = (status: QueryExecutionStatus) => FAILED_STATUSES.includes(status);
