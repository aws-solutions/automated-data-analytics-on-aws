/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { Connectors } from '@ada/connectors';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductStore } from '../../../ddb/data-product';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../start-data-product-infra-deployment';
import { localDynamoLockClient } from '../../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../../api/components/entity/relationships/mock';

const mockAddTags = jest.fn();

const cfnSymbol = Symbol.for('@aws-cdk/cx-api.CloudFormationStackArtifact');
// Mock cdk apps to ensure we don't synthesize any resources
jest.mock('aws-cdk-lib', () => ({
  ...(jest.requireActual('aws-cdk-lib') as any),
  App: class MockApp {
    public synth = jest.fn().mockReturnValue({
      getStackByName: jest.fn().mockReturnValue({
        [cfnSymbol]: 'CloudFormation',
        dependencies: [],
        tags: {
          Application: 'Ada',
        },
      }),
    });
  },

  Tags: {
    of: () => ({ add: mockAddTags }),
  },
}));

const mockListChangeSets = jest.fn();
const mockExecuteChangeSet = jest.fn();
const mockGetParameter = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCloudFormationInstance: jest.fn().mockImplementation(() => ({
    listChangeSets: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListChangeSets(...args))),
    }),
    executeChangeSet: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockExecuteChangeSet(...args))),
    }),
  })),
  AwsSSMInstance: jest.fn().mockImplementation(() => ({
    getParameter: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetParameter(...args))),
    }),
  })),
}));

jest.mock('aws-cdk/lib/api/aws-auth', () => ({
  SdkProvider: {
    withAwsCliCompatibleDefaults: jest.fn(),
  },
}));

const mockDeployStack = jest.fn();
const mockBuildSingleAsset = jest.fn();
const mockPublishSingleAsset = jest.fn();

jest.mock('aws-cdk/lib/api/deployments', () => ({
  Deployments: class MockDeployments {
    public deployStack = (...args: any[]) => Promise.resolve(mockDeployStack(...args));
    public buildSingleAsset = (...args: any[]) => Promise.resolve(mockBuildSingleAsset(...args));
    public publishSingleAsset = (...args: any[]) => Promise.resolve(mockPublishSingleAsset(...args));
  },
}));

describe('start-data-product-infra-deployment', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());

  const getStackClassSpy = jest.spyOn(Connectors.Infra.Dynamic, 'getStackClass');

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.resetAllMocks();
    localDynamoLockClient();
    localDynamoRelationshipClient();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);
    mockGetParameter.mockReturnValue({
      Parameter: { Value: '{}' },
    });

    getStackClassSpy.mockReturnValue(jest.fn() as any);
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  it('should start an infrastructure deployment with cloudformation', async () => {
    mockDeployStack.mockReturnValue({ stackArn: 'test-stack-id' });
    mockListChangeSets.mockReturnValue({
      Summaries: [{ ChangeSetId: 'test-change-set-id' }],
    });

    const response = await handler(
      {
        Payload: {
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
          callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
        },
      },
      null,
    );
    expect(response.cloudFormationStackId).toBe('test-stack-id');

    // Check that we did not request that CDK deploy the stack - we explicitly deploy by executing the change set
    // prepared by CDK, so that we are able to trigger the deployment asynchronously.
    expect(mockDeployStack).toHaveBeenCalledWith(
      expect.objectContaining({
        execute: false,
      }),
    );

    expect(mockListChangeSets).toHaveBeenCalledWith({
      StackName: 'test-stack-id',
    });

    expect(mockExecuteChangeSet).toHaveBeenCalledWith({
      ChangeSetName: 'test-change-set-id',
      StackName: 'test-stack-id',
    });

    // Stack id should be added to the data product
    expect(
      await testDataProductStore.getDataProduct(
        DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
        DEFAULT_S3_SOURCE_DATA_PRODUCT.dataProductId,
      ),
    ).toEqual(
      expect.objectContaining({
        cloudFormationStackId: 'test-stack-id',
      }),
    );
  });

  it('should throw an error for unsupported source types', async () => {
    const BAD_SOURCE_TYPE = 'bad-source-type' as Connectors.ID;
    getStackClassSpy.mockImplementationOnce(() => {
      throw new Error(`Connector ${BAD_SOURCE_TYPE} does not exist`);
    });

    // Create our new dataProduct
    await expect(
      async () =>
        await handler(
          {
            Payload: {
              dataProduct: {
                ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
                sourceType: BAD_SOURCE_TYPE,
              },
              callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
            },
          },
          null,
        ),
    ).rejects.toHaveProperty('message', expect.stringContaining(BAD_SOURCE_TYPE));
  });

  it('should throw an error when cdk generates no change sets', async () => {
    mockDeployStack.mockReturnValue({ stackArn: 'test-stack-id' });
    mockListChangeSets.mockReturnValue({
      Summaries: [],
    });
    // Create our new dataProduct
    await expect(
      async () =>
        await handler(
          {
            Payload: {
              dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
              callingUser: { userId: 'test-user', username: 'test-user@usr.example.com', groups: [] },
            },
          },
          null,
        ),
    ).rejects.toHaveProperty('message', expect.stringContaining('single change set'));
  });
});
