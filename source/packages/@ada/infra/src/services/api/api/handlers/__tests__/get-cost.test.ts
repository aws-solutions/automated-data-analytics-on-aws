/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { VError } from 'verror';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent } from '@ada/microservice-test-common';
import { handler } from '../get-cost';
import { noopMockLockClient } from '../../../components/entity/locks/mock';
import { noopMockRelationshipClient } from '../../../components/entity/relationships/mock';

const mockGetUsageCosts = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCostExplorerInstance: jest.fn().mockImplementation(() => ({
    getCostAndUsage: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetUsageCosts(...args))),
    }),
  })),
}));

describe('get-cost', () => {
  beforeEach(async () => {
    // @ts-ignore
    jest.resetAllMocks();
    noopMockLockClient();
    noopMockRelationshipClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const getCostHandler = (startTimestamp: string, endTimestamp: string): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: { startTimestamp, endTimestamp },
      }),
      null,
    );

  it('should return costs', async () => {
    const costs = {
      GroupDefinitions: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
        {
          Type: 'TAG',
          Key: 'Application',
        },
      ],
      ResultsByTime: [
        {
          TimePeriod: {
            Start: '2021-11-21',
            End: '2021-11-22',
          },
          Total: {
            BlendedCost: {
              Amount: '0',
              Unit: 'USD',
            },
            UsageQuantity: {
              Amount: '0',
              Unit: 'N/A',
            },
          },
          Groups: [],
          Estimated: true,
        },
        {
          TimePeriod: {
            Start: '2021-11-22',
            End: '2021-11-23',
          },
          Total: {
            BlendedCost: {
              Amount: '0',
              Unit: 'USD',
            },
            UsageQuantity: {
              Amount: '0',
              Unit: 'N/A',
            },
          },
          Groups: [],
          Estimated: true,
        },
      ],
      DimensionValueAttributes: [],
    };

    const expected = {
      groupDefinitions: [
        {
          type: 'DIMENSION',
          key: 'SERVICE',
        },
        {
          type: 'TAG',
          key: 'Application',
        },
      ],
      resultsByTime: [
        {
          timePeriod: {
            start: '2021-11-21',
            end: '2021-11-22',
          },
          total: {
            blendedCost: {
              amount: '0',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '0',
              unit: 'N/A',
            },
          },
          groups: [],
          estimated: true,
        },
        {
          timePeriod: {
            start: '2021-11-22',
            end: '2021-11-23',
          },
          total: {
            blendedCost: {
              amount: '0',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '0',
              unit: 'N/A',
            },
          },
          groups: [],
          estimated: true,
        },
      ],
      dimensionValueAttributes: [],
    };

    mockGetUsageCosts.mockReturnValue(costs);
    const response = await getCostHandler('2021-11-22', '2021-11-24');
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual(expected);
  });

  it('should return 400 if date format is invalid', async () => {
    const response = await getCostHandler('2021-30-20', '2021-30-20');
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Invalid start date. Should be yyyy-mm-dd');
  });

  it('should return 404 if there is no response', async () => {
    mockGetUsageCosts.mockReturnValue('');
    const response = await getCostHandler('2021-11-22', '2021-11-24');
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('Unable to get costs');
  });

  it('should throw an error if it fails to get costs from CostExplorer', async () => {
    mockGetUsageCosts.mockRejectedValue(new VError());
    const response = await getCostHandler('2021-11-22', '2021-11-24');
    expect(response.body).toContain('CostError');
  });
});
