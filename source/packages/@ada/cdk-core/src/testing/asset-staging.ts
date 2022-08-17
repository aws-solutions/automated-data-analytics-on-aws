/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { AssetStaging } from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { ISource, Source, SourceConfig } from 'aws-cdk-lib/aws-s3-deployment';

/**
 * Mocks CDK AssetStaging and deployment Source to prevent resolving paths during
 * test constructions. This is expected to be called in jest `beforeAll()` hook.
 * @returns
 */
export function mockAssetStaging() {
  // https://github.com/aelbore/esbuild-jest/issues/26#issuecomment-893763840
  const mock = { AssetStaging, Source, DockerImageAsset };

  const DockerImageAssetSpy = jest.spyOn(mock, 'DockerImageAsset');
  DockerImageAssetSpy.mockImplementation((jest.createMockFromModule('aws-cdk-lib/aws-ecr-assets') as any).DockerImageAsset);

  const AssetStagingSpy = jest.spyOn(mock, 'AssetStaging');
  AssetStagingSpy.mockImplementation((..._args: any[]): any => {
    return {
      sourcePath: 'mock',
      stagedPath: 'mock',
      absoluteStagedPath: '/mock',
      assetHash: 'mock',
    } as unknown as InstanceType<typeof AssetStaging>;
  });

  const SourceMock = jest.fn(
    (..._args: any[]): ISource => ({
      bind: (..._args: any[]): SourceConfig => ({
        bucket: {
          addEventNotification: jest.fn(),
          addObjectCreatedNotification: jest.fn(),
          addObjectRemovedNotification: jest.fn(),
          addToResourcePolicy: jest.fn(),
          arnForObjects: jest.fn(),
          bucketArn: 'mock',
          bucketDomainName: 'mock',
          bucketDualStackDomainName: 'mock',
          bucketName: 'mock',
          bucketRegionalDomainName: 'mock',
          bucketWebsiteDomainName: 'mock',
          bucketWebsiteUrl: 'mock',
          grantDelete: jest.fn(),
          grantPublicAccess: jest.fn(),
          grantPut: jest.fn(),
          grantPutAcl: jest.fn(),
          grantRead: jest.fn(),
          grantReadWrite: jest.fn(),
          grantWrite: jest.fn(),
          env: {} as any,
          node: {} as any,
          urlForObject: jest.fn(),
          onCloudTrailEvent: jest.fn(),
          onCloudTrailPutObject: jest.fn(),
          onCloudTrailWriteObject: jest.fn(),
          s3UrlForObject: jest.fn(),
          stack: {} as any,
          virtualHostedUrlForObject: jest.fn(),
          transferAccelerationUrlForObject: jest.fn(),
          applyRemovalPolicy: jest.fn(),
          enableEventBridgeNotification: jest.fn(),
        },
        zipObjectKey: 'mock',
      }),
    }),
  );

  Source.asset = SourceMock;
  Source.bucket = SourceMock;

  return {
    DockerImageAsset,
    DockerImageAssetSpy,
    AssetStaging,
    Source,
    AssetStagingSpy,
    SourceMock,
  };
}
