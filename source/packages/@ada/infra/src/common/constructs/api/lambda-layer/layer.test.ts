/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { ApiLambdaLayer } from '.';
import { App, Stack } from 'aws-cdk-lib';

describe('api/lambda-layer', () => {
  it('should synthesize lambda layer with nodejs folder and dependencies', async () => {
    const stack = new Stack();
    ApiLambdaLayer.of(stack);

    const synthesized = App.of(stack)!.synth();

    expect(synthesized).toBeDefined();

    const cdkoutDir = synthesized.directory;
    const assetDirs = (await fs.readdir(cdkoutDir)).filter((child) => child.startsWith('asset.'));
    let nodejsDir: string | null = null;
    for (const assetDir of assetDirs) {
      const _nodejsDir = path.join(cdkoutDir, assetDir, 'nodejs');
      if (await fs.pathExists(_nodejsDir)) {
        nodejsDir = _nodejsDir;
        break;
      }
    }

    if (nodejsDir == null) {
      throw new Error('Failed to find nodjs dir');
    }

    // api-client-lambda will get moved to node_modules only during infra build, not in test
    expect(await fs.pathExists(path.join(nodejsDir, 'api-client-lambda'))).toBeTruthy();
    // api-client should be in node_modules along with dependencies
    expect(await fs.pathExists(path.join(nodejsDir, 'node_modules/@ada/api-client'))).toBeTruthy();
    expect(await fs.pathExists(path.join(nodejsDir, 'node_modules/isomorphic-fetch'))).toBeTruthy();
  });
});
