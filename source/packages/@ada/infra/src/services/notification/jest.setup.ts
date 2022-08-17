/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

const JEST_DYNAMODB_CONFIG = path.resolve(__dirname, '.jest.test-cdk-environment.json');
const { environmentVariables, port } = require(JEST_DYNAMODB_CONFIG);

process.env = {
  ...process.env,
  ...environmentVariables,
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
};
