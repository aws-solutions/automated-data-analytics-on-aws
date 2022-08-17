/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { DEFAULT_S3_SOURCE_DATA_PRODUCT } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../check-data-product-infra-deployment-status';

const mockDescribeStacks = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCloudFormationInstance: jest.fn().mockImplementation(() => ({
    describeStacks: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeStacks(...args))),
    }),
  })),
}));

describe('check-data-product-infra-deployment-status', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should identify that the deployment is complete', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_COMPLETE',
        },
      ],
    });
    const response = await handler(
      {
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
          cloudFormationStackId: 'test-stack-id',
        },
      },
      null,
    );
    expect(response.isDeploymentComplete).toBe(true);
    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });
  });

  it('should identify that the deployment is in progress', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_IN_PROGRESS',
        },
      ],
    });
    const response = await handler(
      {
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
          cloudFormationStackId: 'test-stack-id',
        },
      },
      null,
    );
    expect(response.isDeploymentComplete).toBe(false);
    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });
  });

  it('should throw error if describe stacks returns anything other than one stack', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [
        {
          StackStatus: 'CREATE_IN_PROGRESS',
        },
        {
          StackStatus: 'FAILED',
        },
      ],
    });

    expect(async () => {
      await handler(
        {
          Payload: {
            dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
            callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
            cloudFormationStackId: 'test-stack-id',
          },
        },
        null,
      );
    }).rejects.toThrow(/No stack found with id test-stack-id/);
    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });
  });
});
