/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../invoke-generate-query';

const mockInvokeLambda = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  AwsLambdaInstance: jest.fn().mockImplementation(() => ({
    invoke: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockInvokeLambda(...args))),
    }),
  })),
}));

describe('invoke-generate-query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should invoke the generate query lambda and return the output', async () => {
    const input = {
      query: 'select * from foo',
      callingUser: {
        userId: 'user-id',
        username: 'user-id@usr.example.com',
        groups: ['a-group'],
      },
    };
    const output = { query: 'select * from bar' };
    mockInvokeLambda.mockReturnValue({
      Payload: JSON.stringify({
        statusCode: 200,
        body: JSON.stringify(output),
      }),
    });

    const result = await handler(
      {
        Payload: input,
      },
      null,
    );

    expect(mockInvokeLambda).toHaveBeenCalledWith({
      FunctionName: expect.any(String),
      Payload: JSON.stringify(
        buildApiRequest(
          { userId: input.callingUser.userId, username: input.callingUser.username, groups: input.callingUser.groups },
          { body: { query: input.query } },
        ),
      ),
    });
    expect(result.query).toBe(output.query);
  });

  it('should throw an error if the generate query lambda returns a wrong statusCode', async () => {
    const input = {
      query: 'select * from foo',
      callingUser: {
        userId: 'user-id',
        username: 'user-id@usr.example.com',
        groups: ['a-group'],
      },
    };
    const output = { message: 'any-error' };
    mockInvokeLambda.mockReturnValue({
      Payload: JSON.stringify({
        statusCode: 400,
        body: JSON.stringify(output),
      }),
    });

    await expect(
      handler(
        {
          Payload: input,
        },
        null,
      ),
    ).rejects.toThrow('any-error');

    expect(mockInvokeLambda).toHaveBeenCalledWith({
      FunctionName: expect.any(String),
      Payload: JSON.stringify(
        buildApiRequest(
          { userId: input.callingUser.userId, username: input.callingUser.username, groups: input.callingUser.groups },
          { body: { query: input.query } },
        ),
      ),
    });
  });
});
