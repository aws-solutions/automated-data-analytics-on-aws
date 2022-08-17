/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IRelationshipClient, RelationshipClient } from './client';
import { getLocalDynamoDocumentClient } from '../../../../../../src/common/services/testing/ddb';

const { RelationshipClient: OriginalRelationshipClient } = jest.requireActual('./client');
const getOriginalRelationshipClientInstance = OriginalRelationshipClient.getInstance;

export const noopMockRelationshipClient = (): IRelationshipClient => {
  const mockRelationshipClient = {
    addRelationships: jest.fn().mockImplementation(() => Promise.resolve()),
    removeRelationships: jest.fn().mockImplementation(() => Promise.resolve()),
    removeAllRelationships: jest.fn().mockImplementation(() => Promise.resolve()),
    diffRelationships: jest.fn().mockImplementation(() => Promise.resolve({ childrenToAdd: [], childrenToRemove: [] })),
    updateRelationships: jest.fn().mockImplementation(() => Promise.resolve()),
    getRelatedEntities: jest.fn().mockImplementation(() => Promise.resolve([])),
    getRelatedEntitiesOfType: jest.fn().mockImplementation(() => Promise.resolve([])),
  };
  jest.spyOn(RelationshipClient, 'getInstance').mockImplementation(() => mockRelationshipClient);
  return mockRelationshipClient;
};

export const localDynamoRelationshipClient = (): IRelationshipClient => {
  const client = getOriginalRelationshipClientInstance(getLocalDynamoDocumentClient());
  jest.spyOn(RelationshipClient, 'getInstance').mockImplementation(() => {
    return client;
  });
  return client;
};
