/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

const JEST_DYNAMODB_CONFIG = path.resolve(__dirname, '.jest.test-cdk-environment.json');
const { environmentVariables, port } = require(JEST_DYNAMODB_CONFIG);

process.env = {
  ...process.env,
  ...environmentVariables,
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
  DATA_PRODUCT_STATIC_INFRASTRUCTURE: JSON.stringify({
    rawDatabaseArn: 'raw-db',
  }),
  FILE_UPLOAD_BUCKET_NAME: 'file-upload-bucket',
  SCRIPT_BUCKET_NAME: 'script-bucket',
  DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN: 'arn:aws:states:us-test-2:012345678910:stateMachine:Preview',
};

// uuid leaves open handles in jest
jest.mock('uuid', () => ({
  v1: () => 'uuid0000-0000-0000-0000-000000000000',
  v4: () => 'uuid0000-0000-0000-0000-000000000000',
}))
