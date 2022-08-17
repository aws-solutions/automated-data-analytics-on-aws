/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ILockClient, LockClient } from './client';
import { getLocalDynamoDocumentClient } from '../../../../../../src/common/services/testing/ddb';

const { LockClient: OriginalLockClient } = jest.requireActual('./client');
const getOriginalLockClientInstance = OriginalLockClient.getInstance;

/**
 * Mocks the lock client to not acquire any locks (this is the default behaviour for all tests since the lock client
 * requires real time to pass and is therefore not compatible with jest.useFakeTimers)
 */
export const noopMockLockClient = (): ILockClient => {
  const mockLockClient = {
    acquire: jest.fn().mockImplementation((...entities: any[]) => {
      // Check that we always acquire a valid lock
      entities.forEach((entity) => {
        expect(entity.type).toBeDefined();
        expect(entity.identifierParts).not.toContain(undefined);
      });
      return Promise.resolve(
        entities.map((entity) => ({
          entity,
          release: () => Promise.resolve(entity),
        })),
      );
    }),
    releaseAll: jest.fn().mockImplementation(() => Promise.resolve([])),
    release: jest.fn().mockImplementation((...locks: any[]) => Promise.all(locks.map((lock: any) => lock.release()))),
  };
  jest.spyOn(LockClient, 'getInstance').mockImplementation(() => mockLockClient);
  return mockLockClient;
};

/**
 * Points the lock client at local dynamodb for "real" locking in tests
 */
export const localDynamoLockClient = () => {
  jest.spyOn(LockClient, 'getInstance').mockImplementation((operationName) => {
    return getOriginalLockClientInstance(operationName, getLocalDynamoDocumentClient());
  });
};
