/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, buildApiRequest } from '@ada/api-gateway';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { localDynamoLockClient } from '../mock';

// List all locks in the dynamodb table
const listLocks = async () =>
  (
    await getLocalDynamoDocumentClient()
      .scan({
        TableName: process.env.LOCK_TABLE_NAME!,
      })
      .promise()
  ).Items!;

// A handler we can wrap with ApiLambdaHandler.for that will list the currently acquired locks
const listLocksHandler = async () => ApiResponse.success({ message: '', locks: await listLocks() });

describe('automatic-entity-lock', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    localDynamoLockClient();
  });

  it('should not lock an entity for a query type operation', async () => {
    // Check how many locks are held within the handler (since the handler releases all locks on exit)
    const { body } = await ApiLambdaHandler.for('getIdentityGroup', listLocksHandler)(
      buildApiRequest(DEFAULT_CALLER, {
        pathParameters: { groupId: 'some-group' },
      }) as any,
      null,
    );
    const { locks } = JSON.parse(body);
    expect(locks).toHaveLength(0);
  });

  it('should lock an entity for a mutation type operation', async () => {
    // Check how many locks are held within the handler (since the handler releases all locks on exit)
    const { body } = await ApiLambdaHandler.for('putIdentityGroup', listLocksHandler)(
      buildApiRequest(DEFAULT_CALLER, {
        pathParameters: { groupId: 'some-group' },
      }) as any,
      null,
    );
    const { locks } = JSON.parse(body);
    expect(locks).toHaveLength(1);
    expect(locks[0].owner).toMatch(/^putIdentityGroup/);
    expect(locks[0].entityIdentifier).toEqual('IdentityGroup::some-group');
  });
});
