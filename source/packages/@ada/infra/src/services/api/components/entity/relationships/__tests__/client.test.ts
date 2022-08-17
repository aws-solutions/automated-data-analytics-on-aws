/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { EntityIdentifier } from '@ada/api/client/types';
import { RelationshipClient } from '../client';

const client: RelationshipClient = new (RelationshipClient as any)(getLocalDynamoDocumentClient());

const ONE: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-1'],
};
const TWO: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-2'],
};
const THREE: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-3'],
};
const FOUR: EntityIdentifier = {
  type: 'Test',
  identifierParts: ['test', 'id-4'],
};

const ONE_OTHER_TYPE: EntityIdentifier = {
  type: 'Other',
  identifierParts: ['test', 'id-1'],
};
const TWO_OTHER_TYPE: EntityIdentifier = {
  type: 'Other',
  identifierParts: ['test', 'id-2'],
};

describe('relationship-client', () => {
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  it('should add relationships', async () => {
    expect(await client.getRelatedEntities(ONE)).toHaveLength(0);
    expect(await client.getRelatedEntities(TWO)).toHaveLength(0);
    expect(await client.getRelatedEntities(THREE)).toHaveLength(0);

    await client.addRelationships(DEFAULT_CALLER, ONE, [TWO, THREE]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([TWO, THREE]);
    expect(await client.getRelatedEntities(TWO)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);
  });

  it('should remove relationships', async () => {
    await client.addRelationships(DEFAULT_CALLER, ONE, [TWO, THREE]);
    await client.removeRelationships(ONE, [TWO]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([THREE]);
    expect(await client.getRelatedEntities(TWO)).toHaveLength(0);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);
  });

  it('should remove all relationships', async () => {
    await client.addRelationships(DEFAULT_CALLER, ONE, [TWO, THREE]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([TWO, THREE]);

    await client.removeAllRelationships(ONE);

    expect(await client.getRelatedEntities(ONE)).toHaveLength(0);
    expect(await client.getRelatedEntities(TWO)).toHaveLength(0);
    expect(await client.getRelatedEntities(THREE)).toHaveLength(0);
  });

  it('should update relationships', async () => {
    // Should be the same as add relationships since there are no existing relationships
    await client.updateRelationships(DEFAULT_CALLER, ONE, [TWO, THREE]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([TWO, THREE]);
    expect(await client.getRelatedEntities(TWO)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);

    // Should delete relationships between one and two, and add relationships between one and four
    await client.updateRelationships(DEFAULT_CALLER, ONE, [THREE, FOUR]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([THREE, FOUR]);
    expect(await client.getRelatedEntities(TWO)).toHaveLength(0);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(FOUR)).toIncludeSameMembers([ONE]);
  });

  it('should update relationships of only the types included', async () => {
    // Should be the same as add relationships since there are no existing relationships
    await client.updateRelationships(DEFAULT_CALLER, ONE, [TWO, THREE]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([TWO, THREE]);
    expect(await client.getRelatedEntities(TWO)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);

    // Should not delete relationships previously added above, as the children are of a different type
    await client.updateRelationships(DEFAULT_CALLER, ONE, [ONE_OTHER_TYPE, TWO_OTHER_TYPE]);

    expect(await client.getRelatedEntities(ONE)).toIncludeSameMembers([TWO, THREE, ONE_OTHER_TYPE, TWO_OTHER_TYPE]);
    expect(await client.getRelatedEntities(TWO)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(THREE)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(ONE_OTHER_TYPE)).toIncludeSameMembers([ONE]);
    expect(await client.getRelatedEntities(TWO_OTHER_TYPE)).toIncludeSameMembers([ONE]);
  });
});
