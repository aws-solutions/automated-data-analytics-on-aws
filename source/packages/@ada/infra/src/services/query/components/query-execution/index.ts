/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import { QueryHistoryStore } from '../ddb/query-history';
import { extractExecutionIdFromExecutionArn, startStateMachineExecution } from '../step-functions';

const ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN = process.env.ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN ?? '';

/**
 * Start the state machine execution that run the query and save it for the current user
 * @param query the query to be executed
 * @param callingUser the user that is performing the query
 * @param saveQuery flag that define whether the query hs to be saved in the history or not (default=true)
 * @returns the execution id of the step function
 */
export const startAndSaveQuery = async (query: string, callingUser: CallingUser, saveQuery = true): Promise<string> => {
  const result = await startStateMachineExecution(ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN, {
    query,
    callingUser,
  });
  const executionId = extractExecutionIdFromExecutionArn(result.executionArn);
  console.log(`Extracted executionId: ${executionId}`);

  if (saveQuery) {
    try {
      await QueryHistoryStore.getInstance().putQueryHistory(
        {
          query,
          executionId,
        },
        callingUser.userId,
      );
    } catch (err) {
      console.error('Error saving the query in the history');
      console.error(err);
      // avoid bubbling the error up as query history should not affect query execution
    }
  }

  return executionId;
};
