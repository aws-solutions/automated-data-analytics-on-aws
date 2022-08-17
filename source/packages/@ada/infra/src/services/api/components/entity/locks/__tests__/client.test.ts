/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { EntityIdentifier } from '@ada/api-client/types';
import { Group } from '@ada/api-client';
import { GroupStore } from '../../../ddb/groups';
import { LockClient } from '../client';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { localDynamoLockClient } from '../mock';
import { sleep } from '@ada/common';

const TEST_ENTITY: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-1'],
};
const ANOTHER_ENTITY: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-2'],
};

// List all locks in the dynamodb table
const listLocks = async () =>
  (
    await getLocalDynamoDocumentClient()
      .scan({
        TableName: process.env.LOCK_TABLE_NAME!,
      })
      .promise()
  ).Items!;

const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());

describe('lock-client', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    localDynamoLockClient();
  });

  it('should acquire and release a lock on an entity', async () => {
    const client = LockClient.getInstance('test');

    const [lock] = await client.acquire(TEST_ENTITY);

    const locks = await listLocks();
    expect(locks).toHaveLength(1);
    expect(locks[0]).toHaveProperty('entityIdentifier', 'Test::test:id-1');

    expect(await lock.release()).toEqual(TEST_ENTITY);

    // Should successfully acquire and release again - lock will still exist in ddb after being released, so best way
    // to test for successful release is to acquire again without the test timing out!
    const [newLock] = await client.acquire(TEST_ENTITY);
    expect(await newLock.release()).toEqual(TEST_ENTITY);
  });

  it('should acquire and release multiple locks', async () => {
    const client = LockClient.getInstance('test-multiple');

    const [lock1, lock2] = await client.acquire(TEST_ENTITY, ANOTHER_ENTITY);

    expect(lock1.entity).toEqual(TEST_ENTITY);
    expect(lock2.entity).toEqual(ANOTHER_ENTITY);

    const locks = await listLocks();
    expect(locks).toHaveLength(2);
    expect(locks.map((l) => l.entityIdentifier)).toIncludeSameMembers(['Test::test:id-2', 'Test::test:id-1']);

    expect(await client.releaseAll()).toIncludeSameMembers([TEST_ENTITY, ANOTHER_ENTITY]);

    // Should successfully acquire and release again - lock will still exist in ddb after being released, so best way
    // to test for successful release is to acquire again without the test timing out!
    const [newLock1, newLock2] = await client.acquire(TEST_ENTITY, ANOTHER_ENTITY);
    await newLock1.release();
    await newLock2.release();
  });

  it('should block another process until the lock is released', async () => {
    // Group to write to ddb - we don't really care about the contents as we'll check who created/updated it
    const group: Group = {
      groupId: 'group-id',
      apiAccessPolicyIds: [],
      claims: [],
      members: [],
    };
    // increase jest timeout to cope with the lock release timeout
    jest.setTimeout(10000);
    // This "process" acquires the lock first, writes to dynamodb, then releases the lock.
    const blocker = async () => {
      const client = LockClient.getInstance('blocker');
      await client.acquire(TEST_ENTITY);

      // Wait for a second to test that the blocked "process" waits on the lock
      await sleep(1000);

      // Write a group to the groups table - this should be the first write and so 'blocker' should be the creator
      await testGroupStore.putGroup('group-id', 'blocker', group);

      await client.releaseAll();
    };

    // This "process" acquires the lock afterwards, but must wait for the lock to be released before writing to dynamodb.
    const blocked = async () => {
      // Wait for a little bit to ensure the other "process" acquires the lock first
      await sleep(500);

      const client = LockClient.getInstance('blocked');
      await client.acquire(TEST_ENTITY);

      // Write a group to the groups table - this should be the second write and so 'blocker' should still be the creator
      // this should throw exception as parallel updates happening
      try {
        await testGroupStore.putGroup('group-id', 'blocked', group);
      } catch (e) {}

      await client.releaseAll();
    };

    // Kick off both in parallel
    await Promise.all([blocker(), blocked()]);

    const writtenGroup = await testGroupStore.getGroup('group-id');
    expect(writtenGroup.createdBy).toBe('blocker');
    expect(writtenGroup.updatedBy).toBe('blocker');
  });
});
