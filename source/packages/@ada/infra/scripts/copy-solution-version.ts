/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as path from 'path';

const { awsSolutionId, awsSolutionVersion } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), { encoding: 'utf-8' }),
);

fs.writeFileSync(
  path.resolve(
    __dirname,
    '../src/common/constructs/api/lambda-layer/code/nodejs/api-client-lambda/jwt-signer/version.json',
  ),
  JSON.stringify({
    awsSolutionId,
    awsSolutionVersion,
  }),
);
