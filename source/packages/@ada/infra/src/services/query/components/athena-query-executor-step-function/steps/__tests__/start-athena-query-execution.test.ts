/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../start-athena-query-execution';

const mockStartQuery = jest.fn();
const mockAssumeRole = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsAthenaInstance: jest.fn().mockImplementation(() => ({
    startQueryExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartQuery(...args))),
    }),
  })),
  AwsSTSInstance: jest.fn().mockImplementation(() => ({
    assumeRole: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockAssumeRole(...args))),
    }),
  })),
}));

describe('start-athena-query-execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssumeRole.mockReturnValue({
      Credentials: {
        AccessKeyId: 'testAccessKey',
        SecretAccessKey: 'testSecretAccessKey',
        SessionToken: 'testSessionToken',
      },
    });
  });

  it('should start the query execution on athena', async () => {
    mockStartQuery.mockReturnValue({
      QueryExecutionId: 'an-execution-id',
    });

    const result = await handler(
      {
        Payload: {
          query: 'select * from foo',
          callingUser: {
            userId: 'user-id',
            username: 'user-id@usr.example.com',
            groups: ['a-group'],
          },
        },
      },
      null,
    );

    expect(mockStartQuery).toHaveBeenCalledWith({
      QueryString: 'select * from foo',
      ResultConfiguration: {
        OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/user-id`,
      },
    });
    expect(result.queryExecutionId).toBe('an-execution-id');
  });

  it('should assume a role with the calling user and query service', async () => {
    mockStartQuery.mockReturnValue({
      QueryExecutionId: 'an-execution-id',
    });

    await handler(
      {
        Payload: {
          query: 'select * from foo',
          callingUser: {
            userId: 'user-id',
            username: 'user-id@usr.example.com',
            groups: ['a-group', 'another-group'],
          },
        },
      },
      null,
    );

    expect(mockAssumeRole).toHaveBeenCalledWith(
      expect.objectContaining({
        Tags: [
          { Key: 'ada:service', Value: 'query' },
          { Key: 'ada:user', Value: 'user-id' },
          { Key: 'ada:groups', Value: ':a-group:another-group:' },
        ],
      }),
    );
  });

  it('should start the query execution on athena with a custom output path', async () => {
    mockStartQuery.mockReturnValue({
      QueryExecutionId: 'an-execution-id',
    });

    const result = await handler(
      {
        Payload: {
          query: 'select * from foo',
          callingUser: {
            userId: 'user-id',
            username: 'user-id@usr.example.com',
            groups: ['a-group'],
          },
          outputS3Path: 's3://custom/path',
        },
      },
      null,
    );

    expect(mockStartQuery).toHaveBeenCalledWith({
      QueryString: 'select * from foo',
      ResultConfiguration: {
        OutputLocation: 's3://custom/path',
      },
    });
    expect(result.queryExecutionId).toBe('an-execution-id');
  });
});
