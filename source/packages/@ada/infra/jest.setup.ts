/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable */
import { noopMockLockClient } from './src/services/api/components/entity/locks/mock';
import { noopMockRelationshipClient } from './src/services/api/components/entity/relationships/mock';
import { TEST_ACCOUNT, TEST_REGION } from '@ada/cdk-core'

process.env = {
  ...process.env,
  AWS_ACCOUNT: TEST_ACCOUNT,
  AWS_REGION: TEST_REGION,
};

jest.mock('@aws-cdk/aws-lambda-python-alpha/lib/bundling', () => ({
  Bundling: {
    bundle: () => {
      return require('aws-cdk-lib/aws-lambda').AssetCode.fromInline('mock');
    },
  },
}));

jest.mock('aws-cdk-lib/core/lib/bundling.js', () => ({
  ...(jest.requireActual('aws-cdk-lib/core/lib/bundling.js') as any),
  BundlingDockerImage: class BundlingDockerImage {
    static fromRegistry() {
      new BundlingDockerImage();
    }

    static fromAsset() {
      new BundlingDockerImage();
    }

    constructor() {}

    run() {
      return 'mock';
    }

    cp() {
      return 'mock';
    }
  },
  DockerImage: class DockerImage {
    static fromRegistry() {
      new DockerImage();
    }

    static fromBuild() {
      new DockerImage();
    }

    constructor() {}

    run() {
      return 'mock';
    }

    cp() {
      return 'mock';
    }
  },
}));

noopMockLockClient();
noopMockRelationshipClient();
