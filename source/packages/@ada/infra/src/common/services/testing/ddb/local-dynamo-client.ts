/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* istanbul ignore file */
import { DynamoDB } from '@ada/aws-sdk';

/**
 * Get the parameters for a dynamodb client to point to a local dynamo instance
 */
const getLocalDynamoClientParams = () => {
  if (!process.env.MOCK_DYNAMODB_ENDPOINT) {
    throw new Error('No mock dynamodb endpoint set! Please check jest-dynamodb-config.js and jest.config.js');
  }
  return {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local-env',
  };
};

export async function deleteAllTables (client: DynamoDB) {
  return Promise.all(
    ((await client.listTables().promise()).TableNames || []).map((TableName) =>
      client.deleteTable({ TableName }).promise(),
    ),
  );
}

// There is inconsistency with client instantiation in unit tests, making it difficult to clean
// the client tables between test suites, which prevents using watch. By adding `beforeAll`
// here it will get picked up by tests that use the `getLocalDynamoDocumentClient | getLocalDynamoClient`
// methods and ensure they are cleaned before any tests run in the suite.
(typeof beforeAll === 'function' && process.env.MOCK_DYNAMODB_ENDPOINT) && beforeAll(async () => {
  const client = getLocalDynamoClient();
  await deleteAllTables(client);
})

/**
 * Return a dynamodb document client pointing to local dynamo
 */
export const getLocalDynamoDocumentClient = (): DynamoDB.DocumentClient =>
  // local dynammoDB client is only for testing so no need to user agent or XRay
  new DynamoDB.DocumentClient(getLocalDynamoClientParams());

/**
 * Return a dynamodb client pointing to local dynamo
 */
export const getLocalDynamoClient = (): DynamoDB => new DynamoDB(getLocalDynamoClientParams());

/**
 * Delete any existing dynamodb tables, and create the given ones
 * @param tables the tables to create
 */
export const recreateAllTables = async (tables: DynamoDB.CreateTableInput[]): Promise<void> => {
  const client = getLocalDynamoClient();
  // Delete any tables that may already exist
  await deleteAllTables(client);

  // Create all of the given tables
  await Promise.all(
    tables.map((table) => {
      return client.createTable(table).promise();
    }),
  );

  if (process.env.COUNTER_TABLE_NAME) {
    const dynamoDocClient = getLocalDynamoDocumentClient();
    await Promise.all(
      tables.map((table) =>
        dynamoDocClient
          .put({ TableName: process.env.COUNTER_TABLE_NAME!, Item: { tableName: table.TableName, count: 0 } })
          .promise(),
      ),
    );
  }
};
