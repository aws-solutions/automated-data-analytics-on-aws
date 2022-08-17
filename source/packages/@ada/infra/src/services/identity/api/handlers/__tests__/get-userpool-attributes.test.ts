/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { IdentityAttributes } from '@ada/api';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent } from '@ada/microservice-test-common';
import { handler } from '../get-userpool-attributes';

const describeUserPoolMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    describeUserPool: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(describeUserPoolMock(...args))),
    }),
  })),
}));

describe('get-userpool-attributes', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  const getUserPoolAttributes = (): Promise<APIGatewayProxyResult> => handler(apiGatewayEvent({}), null);

  it('should return the attributes', async () => {
    describeUserPoolMock.mockReturnValue({
      UserPool: {
        SchemaAttributes: [
          {
            Name: 'sub',
            AttributeDataType: 'String',
            DeveloperOnlyAttribute: false,
            Mutable: false,
            Required: true,
            StringAttributeConstraints: {
              MinLength: '1',
              MaxLength: '2048',
            },
          },
          {
            Name: 'custom:claims',
            AttributeDataType: 'String',
            DeveloperOnlyAttribute: false,
            Mutable: true,
            Required: false,
            StringAttributeConstraints: {
              MinLength: '1',
              MaxLength: '2048',
            },
          },
          {
            Name: 'identities',
            AttributeDataType: 'String',
            DeveloperOnlyAttribute: false,
            Mutable: true,
            Required: false,
            StringAttributeConstraints: {},
          },
        ],
      },
    });

    const result = await getUserPoolAttributes();
    const body = JSON.parse(result.body) as IdentityAttributes;

    expect(body).toStrictEqual({
      attributes: [
        { name: 'sub', required: true, type: 'String' },
        { name: 'custom:claims', required: false, type: 'String' },
        { name: 'identities', required: false, type: 'String' },
      ],
    });
  });
});
