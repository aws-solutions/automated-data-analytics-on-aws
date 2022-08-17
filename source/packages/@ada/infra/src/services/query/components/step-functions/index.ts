/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as arn from '../../../../common/services/utils/arn-parser';
import { Athena, AwsStepFunctionsInstance, StepFunctions } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import { Query } from '@ada/api';

const stepFunction = AwsStepFunctionsInstance();

export interface QueryExecutionStepFunctionInput extends Query {
  callingUser: CallingUser;
}

export interface QueryExecutionStepFunctionOutput extends QueryExecutionStepFunctionInput {
  originalQuery: string;
  createdTimestamp: string;
  updatedTimestamp: string;
  queryExecutionId: string;
  athenaStatus: {
    QueryExecution: Athena.QueryExecution;
  };
}

export interface QueryExecutionStepFunctionResult {
  input: QueryExecutionStepFunctionInput;
  output: QueryExecutionStepFunctionOutput;
}

/**
 * Trasform the state machine arn into an execution arn
 * @param stateMachineArn the state machine arn to be used as input
 * @param executionId the ID of the execution (it has to be long to the same state machine as the one defined in the arn)
 * @returns the execution arn
 */
export const getExecutionArnFromStateMachineArn = (stateMachineArn: string, executionId: string): string => {
  const parsedArn = arn.parse(stateMachineArn);
  // format the execution arn starting from the state machine arn
  parsedArn.resource = parsedArn.resource
    .split(':')
    .map((part: string): string => (part === 'stateMachine' ? 'execution' : part))
    .concat(executionId)
    .join(':');

  return arn.build(parsedArn);
};

/**
 * Start a new state machine execution
 * @param stateMachineArn the state machine Arn to start the execution for
 * @param input the input to be provided for this execution
 * @returns a promise with the StartExecutionOutput
 */
export const startStateMachineExecution = (
  stateMachineArn: string,
  input: unknown,
): Promise<StepFunctions.StartExecutionOutput> => {
  console.log(`Starting new state machine execution with stateMachineArn: ${stateMachineArn}`);
  return stepFunction
    .startExecution({
      stateMachineArn: stateMachineArn,
      input: JSON.stringify(input ?? {}),
    })
    .promise();
};

/**
 * Extract the execution id from the execution arn
 * @param stateMachineExecutionArn the arn of the state machine execution
 * @returns and execution id
 */
export const extractExecutionIdFromExecutionArn = (stateMachineExecutionArn: string): string =>
  // get the last component of the ARN which is the execution ID of the step function
  stateMachineExecutionArn.split(':').pop()!;
