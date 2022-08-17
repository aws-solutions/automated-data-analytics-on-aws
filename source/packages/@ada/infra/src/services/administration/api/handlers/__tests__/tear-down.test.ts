/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn } from 'aws-cdk-lib'
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductStore } from '../../../../data-product/components/ddb/data-product';

import { handler as tearDown } from '../tear-down';
import { TearDownMode } from '../types'
import { TestApp, TestStack } from '@ada/cdk-core';

const stack = new TestStack(new TestApp());

const RETAINED_RESOURCES: string[] = [
  Arn.format({ service: 's3', resource: 'bucket-1' }, stack),
  Arn.format({ service: 's3', resource: 'bucket-2' }, stack),
  Arn.format({ service: 'kms', resource: 'key/bucket-1-key' }, stack),
  Arn.format({ service: 'kms', resource: 'alias/bucket-1-key-alias' }, stack),
  Arn.format({ service: 'kms', resource: 'key/bucket-2-key' }, stack),
  Arn.format({ service: 'kms', resource: 'alias/bucket-2-key-alias' }, stack),
  Arn.format({ service: 'logs', resource: 'log-group:TestLogGroup1:log-stream:TestStream1' }, stack),
]

const mockDeleteStack = jest.fn();
const mockDescribeStacks = jest.fn();
const mockListObjectVersions = jest.fn();
const mockDeleteObjects = jest.fn();
const mockDeleteBucket = jest.fn();
const mockDisableKey = jest.fn();
const mockScheduleKeyDeletion = jest.fn();
const mockDeleteKeyAlias = jest.fn();
const mockDeleteLogStream = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCloudFormationInstance: jest.fn().mockImplementation(() => ({
    deleteStack: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteStack(...args))),
    }),
    describeStacks: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDescribeStacks(...args))),
    }),
  })),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    listObjectVersions: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListObjectVersions(...args))),
    }),
    deleteObjects: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteObjects(...args))),
    }),
    deleteBucket: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteBucket(...args))),
    }),
  })),
  AwsKMSInstance: jest.fn().mockImplementation(() => ({
    disableKey: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDisableKey(...args))),
    }),
    scheduleKeyDeletion: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockScheduleKeyDeletion(...args))),
    }),
    deleteAlias: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteKeyAlias(...args))),
    }),
  })),
  AwsCloudWatchLogsInstance: jest.fn().mockImplementation(() => ({
    deleteLogStream: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteLogStream(...args))),
    }),
  })),
}));

describe('tear-down', () => {
  let testDataProductStore: DataProductStore;

  beforeEach(async () => {
    process.env.RETAINED_RESOURCES = JSON.stringify(RETAINED_RESOURCES);
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    // Mock the dataProduct store to point to our local dynamodb
    testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);

    jest.clearAllMocks();

    // Write some data products
    await testDataProductStore.putDataProduct('domain', 'dp1', DEFAULT_CALLER.userId, {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId: 'domain',
      dataProductId: 'dp1',
      cloudFormationStackId: 'cfn-for-dp1',
    });
    await testDataProductStore.putDataProduct('domain', 'dp2', DEFAULT_CALLER.userId, {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId: 'domain',
      dataProductId: 'dp2',
      cloudFormationStackId: 'cfn-for-dp2',
    });
    await testDataProductStore.putDataProduct('domain', 'dp3', DEFAULT_CALLER.userId, {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      domainId: 'domain',
      dataProductId: 'dp3',
      cloudFormationStackId: undefined,
    });

    mockDescribeStacks.mockReturnValue({
      Stacks: [{ StackStatus: 'CREATE_COMPLETE' }],
    });
    mockListObjectVersions.mockReturnValue({});
  });

  it('should tear down with data retained', async () => {
    await tearDown({ mode: TearDownMode.RETAIN_DATA }, null);

    expect(mockDeleteStack).toHaveBeenCalledTimes(3);
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-dp1' });
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-dp2' });
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-core-stack' });

    expect(mockDeleteBucket).not.toHaveBeenCalled();
    expect(mockDisableKey).not.toHaveBeenCalled();
    expect(mockScheduleKeyDeletion).not.toHaveBeenCalled();
    expect(mockDeleteLogStream).not.toHaveBeenCalled();
  });

  it('should not tear down data products that are in progress', async () => {
    mockDescribeStacks.mockReturnValue({
      Stacks: [{ StackStatus: 'DELETE_IN_PROGRESS' }],
    });

    await tearDown({ mode: TearDownMode.RETAIN_DATA }, null);

    expect(mockDeleteStack).toHaveBeenCalledTimes(1);
    expect(mockDeleteStack).not.toHaveBeenCalledWith({ StackName: 'cfn-for-dp1' });
    expect(mockDeleteStack).not.toHaveBeenCalledWith({ StackName: 'cfn-for-dp2' });
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-core-stack' });
  });

  it('should tear down the data buckets in destroy data mode', async () => {
    await tearDown({ mode: TearDownMode.DESTROY_DATA }, null);

    expect(mockDeleteStack).toHaveBeenCalledTimes(3);
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-dp1' });
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-dp2' });
    expect(mockDeleteStack).toHaveBeenCalledWith({ StackName: 'cfn-for-core-stack' });

    expect(mockDeleteBucket).toHaveBeenCalledTimes(2);
    expect(mockDeleteBucket).toHaveBeenCalledWith({ Bucket: 'bucket-1' });
    expect(mockDeleteBucket).toHaveBeenCalledWith({ Bucket: 'bucket-2' });

    expect(mockDisableKey).toHaveBeenCalledTimes(2);
    expect(mockDisableKey).toHaveBeenCalledWith({ KeyId: 'bucket-1-key' });
    expect(mockDisableKey).toHaveBeenCalledWith({ KeyId: 'bucket-2-key' });

    expect(mockScheduleKeyDeletion).toHaveBeenCalledTimes(2);
    expect(mockScheduleKeyDeletion).toHaveBeenCalledWith({ KeyId: 'bucket-1-key' });
    expect(mockScheduleKeyDeletion).toHaveBeenCalledWith({ KeyId: 'bucket-2-key' });

    expect(mockDeleteKeyAlias).toHaveBeenCalledTimes(2);
    expect(mockDeleteKeyAlias).toHaveBeenCalledWith({ AliasName: 'bucket-1-key-alias' });
    expect(mockDeleteKeyAlias).toHaveBeenCalledWith({ AliasName: 'bucket-2-key-alias' });

    expect(mockDeleteLogStream).toHaveBeenCalledTimes(1);
    expect(mockDeleteLogStream).toHaveBeenCalledWith({ logGroupName: 'TestLogGroup1', logStreamName: 'TestStream1' });
  });
});
