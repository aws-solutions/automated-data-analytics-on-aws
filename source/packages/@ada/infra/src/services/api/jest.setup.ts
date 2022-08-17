/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

const JEST_DYNAMODB_CONFIG = path.resolve(__dirname, '.jest.test-cdk-environment.json');
const { environmentVariables, port } = require(JEST_DYNAMODB_CONFIG);

process.env = {
  ...process.env,
  ...environmentVariables,
  MOCK_DYNAMODB_ENDPOINT: `localhost:${port}`,
  testEnvironment: 'node',
  MICRO_SERVICE_PUBLIC_METHODS: JSON.stringify({
    'http://localhost:5001/prod/': [{ method: 'GET', path: '/micro1/{myId}' }],
    'http://localhost:5002/prod/': [{ method: 'POST', path: '/micro2/query' }],
  }),
  ADMIN_EMAIL: 'test@domain.example.com',
  AUTO_ASSOCIATE_ADMIN: 'true',
  USER_POOL_ID: 'user-pool-id',
  DEFAULT_ACCESS_POLICIES: 'default-access1,default-access2',
  MACHINE_JWT_SIGN_SECRET: 'machine-jwt-secret',
  MACHINE_TOKEN_KEY: 'machine-kms-key-id',
  USER_ID_SCOPE: 'ada/userid',
};
