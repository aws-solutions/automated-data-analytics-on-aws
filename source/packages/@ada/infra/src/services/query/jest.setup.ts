/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

const JEST_DYNAMODB_CONFIG = path.resolve(__dirname, '.jest.test-cdk-environment.json');
const { environmentVariables, port } = require(JEST_DYNAMODB_CONFIG);

process.env = {
  ...process.env,
  ...environmentVariables,
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
  ATHENA_QUERY_EXECUTOR_STATE_MACHINE_ARN: 'arn:aws:states:us-east-1:123456789012:stateMachine:machine-name',
  GENERATE_QUERY_FUNCTION_ARN: 'arn:aws:states:us-east-1:123456789012:function:any',
  ATHENA_OUTPUT_BUCKET_NAME: 'athena-output-bucket',
  GOVERNANCE_PERMISSIONS_API: 'https://test.governance/',
};
