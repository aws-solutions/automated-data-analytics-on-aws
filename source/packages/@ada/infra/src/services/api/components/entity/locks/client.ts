/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { EntityIdentifier } from '@ada/api-client/types';
import { FailOpen } from 'dynamodb-lock-client';
import {
  LOCK_ACQUIRE_RETRY_COUNT,
  LOCK_DURATION_MILLISECONDS,
  LOCK_HEARTBEAT_PERIOD_MILLISECONDS,
  LOCK_PARTITION_KEY,
} from './constants';
import { Logger } from '../../../../../common/constructs/lambda/lambda-logger';
import { entityIdentifierToString } from '../index';
import { v4 as uuid } from 'uuid';

export interface LockedEntity {
  entity: EntityIdentifier;
  release: () => Promise<EntityIdentifier>;
}

export interface ILockClient {
  acquire: (...entities: EntityIdentifier[]) => Promise<LockedEntity[]>;
  release: (...locks: LockedEntity[]) => Promise<EntityIdentifier[]>;
  releaseAll: () => Promise<EntityIdentifier[]>;
}

/**
 * Client for locking entities for mutation
 */
export class LockClient implements ILockClient {
  /**
   * Get an instance of the lock client for the given operation. Always creates a new client, since they should not be
   * shared between invocations as different invocations are considered different lock owners for better traceability.
   * @param operationName the operation name, used to distinguish the lock owner.
   * @param ddb dynamodb document client
   */
  /* istanbul ignore next */
  public static getInstance = (
    operationName: string,
    ddb: DynamoDB.DocumentClient = AwsDynamoDBDocumentClient(),
  ): ILockClient => {
    return new LockClient(ddb, `${operationName}-${uuid()}`);
  };

  private readonly client: FailOpen<string>;
  private readonly heldLocks: { [entityIdentifier: string]: LockedEntity } = {};
  private readonly log: Logger;

  private constructor(private ddb: DynamoDB.DocumentClient, private owner: string) {
    this.owner = owner;
    this.ddb = ddb;
    this.client = new FailOpen<string>({
      dynamodb: ddb,
      leaseDurationMs: LOCK_DURATION_MILLISECONDS,
      heartbeatPeriodMs: LOCK_HEARTBEAT_PERIOD_MILLISECONDS,
      // @ts-ignore  @types/dynamodb-lock-client is behind dynamodb-lock-client and missing this property. Upgrade when released.
      retryCount: LOCK_ACQUIRE_RETRY_COUNT,
      lockTable: process.env.LOCK_TABLE_NAME!,
      partitionKey: LOCK_PARTITION_KEY,
      owner,
    });
    this.log = new Logger({
      tags: [owner, 'LockClient', process.env.LOCK_TABLE_NAME!],
    });
    this.log.info('Creating lock client for owner', { owner });
  }

  /**
   * Acquire a lock on a single entity
   * @param entity the entity to lock
   * @returns a locked entity which includes a method to release the lock
   */
  private acquireOne(entity: EntityIdentifier): Promise<LockedEntity> {
    const lockId = entityIdentifierToString(entity);
    const log = this.log;
    return new Promise((resolve, reject) => {
      log.info(`Acquiring lock' ${lockId}, for owner ${this.owner}`);
      this.client.acquireLock(lockId, (error, lock) => {
        if (error) {
          reject(error);
        } else {
          const lockedEntity: LockedEntity = {
            entity,
            release: () =>
              new Promise((_resolve, _reject) => {
                log.info(`Releasing lock' ${lockId}, for owner ${this.owner}`);
                delete this.heldLocks[lockId];
                lock.release((_error) => (_error ? _reject(_error) : _resolve(entity)));
              }),
          };
          this.heldLocks[lockId] = lockedEntity;
          resolve(lockedEntity);
        }
      });
    });
  }

  /**
   * Acquire locks on the given entities
   * @param entities the entities to lock
   */
  public acquire(...entities: EntityIdentifier[]): Promise<LockedEntity[]> {
    return Promise.all(entities.map(this.acquireOne.bind(this)));
  }

  /**
   * Release the given locks in parallel
   * @param locks the locks to release
   */
  public release(...locks: LockedEntity[]): Promise<EntityIdentifier[]> {
    return Promise.all(locks.map((lock) => lock.release()));
  }

  /**
   * Release all locks acquired by this client
   */
  public releaseAll(): Promise<EntityIdentifier[]> {
    return Promise.all(Object.values(this.heldLocks).map((lock) => lock.release()));
  }
}
