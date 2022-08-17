/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AthenaQueryExecutionState, CallingUser, StepFunctionExecutionStatus } from '@ada/common';
import { DEFAULT_CALLER } from '@ada/infra-common/services/testing';
import { QueryDownload } from '@ada/api';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get-signed-url';

const mockDescribeExecution = jest.fn();
const mockSignedUrl = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    describeExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeExecution(...args))),
    }),
  })),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    getSignedUrlPromise: (...args: any[]) => Promise.resolve(mockSignedUrl(...args)),
  })),
}));

// Helper method for calling the handler
const getSignedUrlHandler = (
  executionId: string,
  callingUser: CallingUser = DEFAULT_CALLER,
): Promise<APIGatewayProxyResult> =>
  handler(
    buildApiRequest(callingUser, {
      pathParameters: { executionId },
    }) as any,
    null,
  );

describe('get-signed-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the signed url in case the execution succeeded', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');
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
            ResultConfiguration: {
              OutputLocation: 's3://any-bucket/any/path/to/object.ext',
            },
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getSignedUrlHandler('an-execution-id');
    const body = JSON.parse(result.body) as QueryDownload;

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockSignedUrl).toBeCalledWith('getObject', {
      Bucket: 'any-bucket',
      Expires: 12,
      Key: 'any/path/to/object.ext',
    });
    expect(result.statusCode).toBe(200);
    expect(body.signedUrl).toBe('https://any.signed.url/path/to/object');
  });

  it('should not return the signed url in case the execution succeeded and user belong to the same group', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        callingUser: {
          userId: 'another-user',
          groups: ['analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.SUCCEEDED,
      output: JSON.stringify({
        athenaStatus: {
          QueryExecution: {
            ResultConfiguration: {
              OutputLocation: 's3://any-bucket/any/path/to/object.ext',
            },
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getSignedUrlHandler('an-execution-id', {
      ...DEFAULT_CALLER,
      userId: 'yet-another-user',
      groups: ['analyst'],
    });
    expect(result.statusCode).toBe(403);
  });

  it('should not return the signed url in case the execution succeeded but the user belong to anoher group', async () => {
    mockSignedUrl.mockReturnValue('https://any.signed.url/path/to/object');
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
            ResultConfiguration: {
              OutputLocation: 's3://any-bucket/any/path/to/object.ext',
            },
            Status: {
              State: AthenaQueryExecutionState.SUCCEEDED,
            },
          },
        },
      }),
    });

    const result = await getSignedUrlHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(403);
    expect(body.message).toBe('The user test-user does not have the rights to perform this action');
  });

  it('should return an error if the step function did not succeed', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({
        // default test user/groups
        callingUser: {
          userId: 'test-user',
          groups: ['admin', 'analyst'],
        },
        query: 'select * from foo',
      }),
      status: StepFunctionExecutionStatus.FAILED,
    });

    const result = await getSignedUrlHandler('an-execution-id');
    const body = JSON.parse(result.body);

    expect(mockDescribeExecution).toHaveBeenCalledWith({
      executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
    });
    expect(mockSignedUrl).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(body.message).toBe('Failed to execute query');
    expect(body.details).toBeUndefined();
  });

  it.each([StepFunctionExecutionStatus.SUCCEEDED, StepFunctionExecutionStatus.FAILED])(
    'should return an error if step function state is %s and athena query did not succeed',
    async (stepState) => {
      mockDescribeExecution.mockReturnValue({
        input: JSON.stringify({
          // default test user/groups
          callingUser: {
            userId: 'test-user',
            groups: ['admin', 'analyst'],
          },
          query: 'select * from foo',
        }),
        status: stepState,
        output: JSON.stringify({
          athenaStatus: {
            QueryExecution: {
              ResultConfiguration: {
                OutputLocation: 's3://any-bucket/any/path/to/object.ext',
              },
              Status: {
                State: AthenaQueryExecutionState.FAILED,
                StateChangeReason: 'any underlying error',
              },
            },
          },
        }),
      });

      const result = await getSignedUrlHandler('an-execution-id');
      const body = JSON.parse(result.body);

      expect(mockDescribeExecution).toHaveBeenCalledWith({
        executionArn: `arn:aws:states:us-east-1:123456789012:execution:machine-name:an-execution-id`,
      });
      expect(mockSignedUrl).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(400);
      expect(body.message).toBe('Failed to execute query');
      expect(body.details).toBe('any underlying error');
    },
  );
});
