/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, StepFunctionExecutionStatus } from '@ada/common';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../get-data-product-preview';

const mockDescribeExecution = jest.fn();
const mockGetObject = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsStepFunctionsInstance: jest.fn().mockImplementation(() => ({
    describeExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeExecution(...args))),
    }),
  })),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    getObject: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetObject(...args))),
    }),
  })),
}));

describe('get-data-product-preview', () => {
  // Helper method for calling the handler
  const getPreviewHandler = (caller: CallingUser): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(caller, {
        pathParameters: { previewId: 'some-preview' },
      }) as any,
      null,
    );

  it('should return forbidden if a different caller requests the preview', async () => {
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
    });
    expect(
      (await getPreviewHandler({ userId: 'darthvader', username: 'darthvader', groups: ['sith'] })).statusCode,
    ).toBe(403);

    // Should also be forbidden if part of the same group, but not the initiating user
    mockDescribeExecution.mockReturnValue({
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
    });
    expect(
      (await getPreviewHandler({ userId: 'darthvader', username: 'darthvader', groups: ['jedi'] })).statusCode,
    ).toBe(403);
  });

  it('should return when the state machine is still running', async () => {
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.RUNNING,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
    });

    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.RUNNING,
    });
  });

  it.each([
    StepFunctionExecutionStatus.ABORTED,
    StepFunctionExecutionStatus.FAILED,
    StepFunctionExecutionStatus.TIMED_OUT,
  ])('should return an error when the state machine fails for an unexpected reason', async (status) => {
    mockDescribeExecution.mockReturnValue({
      status,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status,
      error: {
        message: 'Preview execution failed, please try again',
      },
      durationMilliseconds: 11000,
    });
  });

  it('should return an error when the state machine fails for an expected reason', async () => {
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({ ErrorDetails: { Error: 'Something went wrong!' } }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.FAILED,
      error: {
        message: 'Something went wrong!',
      },
      durationMilliseconds: 11000,
    });
  });

  it('should return the step function output payload on success', async () => {
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({ Payload: { initialDataSets: {}, transformedDataSets: {} } }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.SUCCEEDED,
      initialDataSets: {},
      transformedDataSets: {},
      durationMilliseconds: 11000,
    });
  });

  it('should load transformed data from s3 when path is defined', async () => {
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({
        Payload: {
          initialDataSets: {
            ada_default_dataset: {
              classification: 'csv',
              data: [],
              schema: {},
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
              s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
            },
          },
          transformedDataSets: {
            ada_default_dataset: {
              data: [],
              schema: {},
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
            },
          },
        },
      }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    mockGetObject.mockReturnValue({ Body: JSON.stringify([{ character: 'macewindu' }]) });
    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.SUCCEEDED,
      initialDataSets: {
        ada_default_dataset: {
          classification: 'csv',
          data: [{ character: 'macewindu' }],
          schema: {},
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
          s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
        },
      },
      transformedDataSets: {
        ada_default_dataset: {
          data: [{ character: 'macewindu' }],
          schema: {},
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
        },
      },
      durationMilliseconds: 11000,
    });
  });

  it('should return date in the utc', async () => {
    const schema = {
      dataType: 'struct',
      fields: [
        {
          name: 'dob',
          container: {
            dataType: 'date',
          },
        },
      ],
    };
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({
        Payload: {
          initialDataSets: {
            ada_default_dataset: {
              classification: 'csv',
              data: [],
              schema,
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
              s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
            },
          },
          transformedDataSets: {
            ada_default_dataset: {
              data: [],
              schema,
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
            },
          },
        },
      }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    mockGetObject.mockReturnValue({ Body: JSON.stringify([{ character: 'samuel', dob: -663674400000 }]) });
    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.SUCCEEDED,
      initialDataSets: {
        ada_default_dataset: {
          classification: 'csv',
          data: [{ character: 'samuel', dob: '1948-12-20T14:00:00.000Z' }],
          schema,
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
          s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
        },
      },
      transformedDataSets: {
        ada_default_dataset: {
          data: [{ character: 'samuel', dob: '1948-12-20T14:00:00.000Z' }],
          schema,
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
        },
      },
      durationMilliseconds: 11000,
    });
  });

  it('should return datetime in the utc', async () => {
    const schema = {
      dataType: 'struct',
      fields: [
        {
          name: 'dob',
          container: {
            dataType: 'datetime',
          },
        },
      ],
    };
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({
        Payload: {
          initialDataSets: {
            ada_default_dataset: {
              classification: 'csv',
              data: [],
              schema,
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
              s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
            },
          },
          transformedDataSets: {
            ada_default_dataset: {
              data: [],
              schema,
              s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
            },
          },
        },
      }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    mockGetObject.mockReturnValue({ Body: JSON.stringify([{ character: 'samuel', dob: -663674400000 }]) });
    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.SUCCEEDED,
      initialDataSets: {
        ada_default_dataset: {
          classification: 'csv',
          data: [{ character: 'samuel', dob: '1948-12-20T14:00:00.000Z' }],
          schema,
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/source/data.json',
          s3Path: 's3://ada-sandbox-uploads/domain/data-product/source/',
        },
      },
      transformedDataSets: {
        ada_default_dataset: {
          data: [{ character: 'samuel', dob: '1948-12-20T14:00:00.000Z' }],
          schema,
          s3SamplePath: 's3://ada-sandbox-uploads/domain/data-product/transformed/data.json',
        },
      },
      durationMilliseconds: 11000,
    });
  });

  it('should not load transformed data from s3 when path is not defined', async () => {
    mockDescribeExecution.mockReturnValue({
      status: StepFunctionExecutionStatus.SUCCEEDED,
      input: JSON.stringify({ Payload: { callingUser: { userId: 'lukeskywalker', groups: ['jedi'] } } }),
      output: JSON.stringify({
        Payload: {
          initialDataSets: { ada_default_dataset: { classification: 'csv', data: [], schema: {} } },
          transformedDataSets: { ada_default_dataset: { data: [{ character: 'macewindu' }], schema: {} } },
        },
      }),
      startDate: new Date('2021-01-01T00:00:00Z'),
      stopDate: new Date('2021-01-01T00:00:11Z'),
    });

    const response = await getPreviewHandler({ userId: 'lukeskywalker', username: 'lukeskywalker', groups: ['jedi'] });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      previewId: 'some-preview',
      status: StepFunctionExecutionStatus.SUCCEEDED,
      initialDataSets: { ada_default_dataset: { classification: 'csv', data: [], schema: {} } },
      transformedDataSets: {
        ada_default_dataset: { data: [{ character: 'macewindu' }], schema: {} },
      },
      durationMilliseconds: 11000,
    });
  });
});
