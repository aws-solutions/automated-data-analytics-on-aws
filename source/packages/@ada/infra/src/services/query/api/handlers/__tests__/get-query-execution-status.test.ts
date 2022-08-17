/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AthenaQueryExecutionState, CallingUser, StepFunctionExecutionStatus } from '@ada/common';
import { DEFAULT_CALLER } from '@ada/microservice-test-common';
import { QueryStatus } from '@ada/api';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get-query-execution-status';

const mockDescribeExecution = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    describeExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeExecution(...args))),
    }),
  })),
}));

// Helper method for calling the handler
const getExecutionStatusHandler = (
  executionId: string,
  callingUser: CallingUser = DEFAULT_CALLER,
): Promise<APIGatewayProxyResult> =>
  handler(
    buildApiRequest(callingUser, {
      pathParameters: { executionId },
    }) as any,
    null,
  );

describe('get-query-execution-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    StepFunctionExecutionStatus.FAILED,
    StepFunctionExecutionStatus.RUNNING,
    StepFunctionExecutionStatus.ABORTED,
    StepFunctionExecutionStatus.TIMED_OUT,
  ])('should retrieve the step function status (%s) if is not succeeded', async (status) => {
    const queryingUser = {
      ...DEFAULT_CALLER,
      userId: 'querying-user',
      groups: ['analyst'],
    };

    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: queryingUser,
        query: 'select * from foo',
      }),
      status: status,
    });

    const result = await getExecutionStatusHandler('an-execution-id', queryingUser);
    const body = JSON.parse(result.body) as QueryStatus;

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(body.status).toBe(status);
    expect(result.statusCode).toBe(200);
  });

  it('should retrieve the step function status FAILED if the execution completed with an error', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        Error: 'some error',
      }),
    });

    const result = await getExecutionStatusHandler('an-execution-id');
    const body = JSON.parse(result.body) as QueryStatus;

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(body.status).toBe(StepFunctionExecutionStatus.FAILED);
    expect(result.statusCode).toBe(200);
  });

  it.each([AthenaQueryExecutionState.SUCCEEDED, AthenaQueryExecutionState.FAILED, AthenaQueryExecutionState.RUNNING])(
    'should inspect the athena output status if the step function is succeeded (athenaStatus=%s)',
    async (athenaState) => {
      mockDescribeExecution.mockReturnValue({
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: StepFunctionExecutionStatus.SUCCEEDED,
        output: JSON.stringify({
          athenaStatus: {
            QueryExecution: {
              Status: {
                State: athenaState,
              },
            },
          },
        }),
      });

      const result = await getExecutionStatusHandler('an-execution-id');
      const body = JSON.parse(result.body) as QueryStatus;

      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(body.status).toBe(athenaState);
      expect(result.statusCode).toBe(200);
    },
  );

  it('should not succeed if the execution is relative to another user but the enquiring one belongs to the same group', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'querying-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        athenaStatus: {
          QueryExecution: {
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getExecutionStatusHandler('an-execution-id', {
      ...DEFAULT_CALLER,
      groups: ['analyst'],
      userId: 'another-user',
    });

    expect(result.statusCode).toBe(403);
  });

  it('should fail if the execution is relative to another user but the enquiring one DOES NOT belong to the same groups', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'another-user',
          groups: ['developer'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        athenaStatus: {
          QueryExecution: {
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getExecutionStatusHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(body.message).toBe('The user test-user does not have the rights to perform this action');
    expect(result.statusCode).toBe(403);
  });
});
