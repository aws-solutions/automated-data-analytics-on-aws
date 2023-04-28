/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { apiGatewayEvent, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-table-stream';

const mockDescribeTable = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  DynamoDB: jest.fn().mockImplementation(() => ({
    describeTable: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeTable(...args))),
    }),
  })),
}));

describe('get-table-stream', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const getTableStreamHandler = (tableArn?: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { tableArn },
        requestContext: { accountId: '11111111111' },
      }),
      null,
    );

  it('should return a table stream ARN if one exists', async () => {
    const tableARN = 'arn:aws:dynamodb:us-west-2:11111111111:table/1-test-data';
    const tableStreamARN = 'arn:aws:dynamodb:us-west-2:11111111111:table/1-test-data/stream/foo';

    mockDescribeTable.mockReturnValue({
      Table: {
        LatestStreamArn: tableStreamARN,
        StreamSpecification: {
          crossAccount: false,
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      },
    });

    const response = await getTableStreamHandler(encodeURIComponent(tableARN));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        crossAccount: false,
        tableStreamArn: tableStreamARN,
        streamEnabled: true,
        streamViewType: 'NEW_AND_OLD_IMAGES',
      }),
    );
  });

  it('should return a crossAccount flag if the account number is different', async () => {
    const tableARN = 'arn:aws:dynamodb:us-west-2:000000000000:table/1-test-data';

    const response = await getTableStreamHandler(encodeURIComponent(tableARN));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        crossAccount: true,
      }),
    );
  });

  it('should return 400 if the table arn is malformed', async () => {
    const response = await getTableStreamHandler('badarn');
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Table Arn not in correct format');
  });

  it('should return 400 if the table arn is missing', async () => {
    const response = await getTableStreamHandler('');
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Missing required parameters, tableArn is required');
  });
});
