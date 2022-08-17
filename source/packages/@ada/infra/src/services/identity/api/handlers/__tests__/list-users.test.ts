/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ListIdentityUsersResponse } from '@ada/api';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent } from '@ada/microservice-test-common';
import { camelCase } from 'lodash';
import { handler } from '../list-users';

const listUsersMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    listUsers: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(listUsersMock(...args))),
    }),
  })),
}));

describe('list-users', () => {
  const listUsersHandler = (event?: any): Promise<APIGatewayProxyResult> => handler(apiGatewayEvent(event || {}), null);

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('should retrieve the list of users without additional pagination', async () => {
    listUsersMock.mockReturnValue({
      Users: [
        {
          Username: 'first',
          Attributes: [
            { Name: 'email', Value: 'first@email.example.com' },
            { Name: 'preferred_username', Value: 'first_user' },
          ],
        },
      ],
    });

    const result = await listUsersHandler();
    const body = JSON.parse(result.body) as ListIdentityUsersResponse;

    expect(body.users).toStrictEqual([
      {
        username: 'first',
        email: 'first@email.example.com',
        preferredUsername: 'first_user',
      },
    ]);
    expect(body.nextToken).toBeUndefined();
    expect(listUsersMock).toHaveBeenCalledWith({
      UserPoolId: 'user-pool-id',
      Limit: 60,
    });
  });

  it('should return an error if the nextToken is invalid', async () => {
    listUsersMock.mockReturnValue({
      Users: [
        {
          Username: 'first',
          Attributes: [
            { Name: 'email', Value: 'first@email.example.com' },
            { Name: 'preferred_username', Value: 'first_user' },
          ],
        },
      ],
    });

    const result = await listUsersHandler({ queryStringParameters: { nextToken: 'invalid-token' } });
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Invalid nextToken invalid-token',
      name: 'Error',
      errorId: expect.stringMatching(/\w{10}/),
    });
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      [
        { Name: 'email', Value: 'first@email.example.com' },
        { Name: 'preferred_username', Value: 'first_user' },
      ],
    ],
    [[{ Name: 'email', Value: 'first@email.example.com' }]],
    [[{ Name: 'preferred_username', Value: 'first_user' }]],
    [undefined],
  ])('should retrieve the list of users without additional attributes if not available', async (attributes) => {
    listUsersMock.mockReturnValue({
      Users: [
        {
          Username: 'first',
          Attributes: attributes,
        },
      ],
    });

    const result = await listUsersHandler();
    const body = JSON.parse(result.body) as ListIdentityUsersResponse;

    expect(body.users).toStrictEqual([
      {
        username: 'first',
        ...(attributes
          ? attributes.reduce((acc: any, curr: any) => ({ ...acc, [camelCase(curr.Name)]: curr.Value }), {})
          : {}),
      },
    ]);
    expect(body.nextToken).toBeUndefined();
    expect(listUsersMock).toHaveBeenCalledWith({
      UserPoolId: 'user-pool-id',
      Limit: 60,
    });
  });

  it('should retrieve the list of users with pagination details', async () => {
    listUsersMock.mockReturnValueOnce({
      Users: [
        {
          Username: 'first',
          Attributes: [
            { Name: 'email', Value: 'first@email.example.com' },
            { Name: 'preferred_username', Value: 'first_user' },
          ],
        },
      ],
      PaginationToken: 'next-page',
    });
    listUsersMock.mockReturnValueOnce({
      Users: [
        {
          Username: 'second',
          Attributes: [
            { Name: 'email', Value: 'second@email.example.com' },
            { Name: 'preferred_username', Value: 'second_user' },
          ],
        },
      ],
    });

    let result = await listUsersHandler({ queryStringParameters: { pageSize: '10' } });
    let body = JSON.parse(result.body) as ListIdentityUsersResponse;

    expect(body.nextToken).toBeDefined();
    expect(body.users).toStrictEqual([
      {
        username: 'first',
        email: 'first@email.example.com',
        preferredUsername: 'first_user',
      },
    ]);
    expect(listUsersMock).toHaveBeenNthCalledWith(1, {
      UserPoolId: 'user-pool-id',
      Limit: 10,
      PaginationToken: undefined,
    });

    result = await listUsersHandler({ queryStringParameters: { nextToken: body.nextToken, pageSize: '10' } });
    body = JSON.parse(result.body) as ListIdentityUsersResponse;

    expect(body.nextToken).toBeUndefined();
    expect(body.users).toStrictEqual([
      {
        username: 'second',
        email: 'second@email.example.com',
        preferredUsername: 'second_user',
      },
    ]);
    expect(listUsersMock).toHaveBeenNthCalledWith(2, {
      UserPoolId: 'user-pool-id',
      Limit: 10,
      PaginationToken: 'next-page',
    });
  });

  it('should retrieve the list of users using the provided filter', async () => {
    listUsersMock.mockReturnValue({
      Users: [
        {
          Username: 'first',
          Attributes: [
            { Name: 'email', Value: 'first@email.example.com' },
            { Name: 'preferred_username', Value: 'first_user' },
          ],
        },
      ],
    });

    const result = await listUsersHandler({
      queryStringParameters: { filter: encodeURIComponent('test_attribute = "abc"') },
    });
    const body = JSON.parse(result.body) as ListIdentityUsersResponse;

    expect(body.users).toStrictEqual([
      {
        username: 'first',
        email: 'first@email.example.com',
        preferredUsername: 'first_user',
      },
    ]);
    expect(body.nextToken).toBeUndefined();
    expect(listUsersMock).toHaveBeenCalledWith({
      UserPoolId: 'user-pool-id',
      Limit: 60,
      Filter: 'test_attribute = "abc"',
    });
  });
});
