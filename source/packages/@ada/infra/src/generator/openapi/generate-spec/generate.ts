/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { AdaStack } from '../../../stacks/ada-stack';
import { AssetCode } from 'aws-cdk-lib/aws-lambda';
import { OpenApiDefinition } from '../../../common/constructs/api';
import { TestApp, TestStack, mockAssetStaging } from '@ada/cdk-core';
import { VError } from 'verror';

// 5 minutes incase bundling creeps in to build again - which shouldn't as has been disabled
// but if we add a new function type it could happen for other case we haven't mocked in the future
jest.setTimeout(5 * 60 * 1000);

beforeAll(() => {
  mockAssetStaging();
});

afterAll(() => {
  jest.resetAllMocks();
});

// transforms depends on api - so need to mock as virtual since does not exist
jest.mock(
  '@ada/transforms',
  () => ({
    BuiltInTransforms: {},
    AUTOMATIC_TRANSFORMS: [],
  }),
  { virtual: true },
);

jest.mock('aws-cdk-lib/aws-ecr-assets', () => ({
  ...(jest.requireActual('aws-cdk-lib/aws-ecr-assets')),
  TarballImageAsset: class {
    public readonly assetHash: string = 'mock';
    public readonly imageUri: string = 'mock';
    public readonly sourceHash: string = 'mock';
    public readonly repository: any = {
      grantPull: jest.fn(),
    };
  },
}));

jest.mock('@aws-cdk/aws-lambda-python-alpha/lib/bundling', () => ({
  ...(jest.requireActual('@aws-cdk/aws-lambda-python-alpha/lib/bundling')),
  bundle: () => {
    return AssetCode.fromInline('mock');
  },
}));

test('generate openapi spec file', async () => {
  console.log('generating openapi spec...');
  const outputFile = process.env.OPENAPI_SPEC_FILE;
  if (outputFile == null) {
    throw new VError({ name: 'EnvironmentVariableNotSetError' }, 'OPENAPI_SPEC_FILE env is required to generate spec');
  }

  await fs.ensureDir(path.dirname(outputFile));

  const app = new TestApp();
  const stack = new TestStack(app);

  console.log('creating stack to defined openapi definition...');
  new AdaStack(stack, 'SpecStack');
  console.log('stack created');

  for (const openapiDef of OpenApiDefinition.instances) {
    console.log('generate spec:', openapiDef.node.path);
    const spec = openapiDef.openapiSpec;
    // console.log('spec:', spec)
    await fs.writeFile(outputFile, spec, { encoding: 'utf-8' });
    console.log('generated spec:', outputFile);
  }
  expect(true).toBe(true);
});
