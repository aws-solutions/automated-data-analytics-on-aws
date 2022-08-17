/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import {
  EntityIdentifier,
  GetEntityIdentifier,
  OperationEntityName,
  identifierFromEntityIdentifier,
} from '@ada/api/client/types';
import { GenericDynamodbStore, paginatedRequest } from '@ada/microservice-common';
import { Logger } from '../../../../../common/constructs/lambda/lambda-logger';
import { entityIdentifierFromString, entityIdentifierToString } from '../index';

/**
 * Defines a relationship between two entities. Relationships are bi-directional.
 */
export interface RelationshipIdentifier {
  left: string;
  right: string;
}

export interface IRelationshipClient {
  getRelatedEntities: (entity: EntityIdentifier) => Promise<EntityIdentifier[]>;
  getRelatedEntitiesOfType: <T extends OperationEntityName>(
    entity: EntityIdentifier,
    type: T,
  ) => Promise<GetEntityIdentifier<T>[]>;
  addRelationships: (callingUser: CallingUser, parent: EntityIdentifier, children: EntityIdentifier[]) => Promise<void>;
  removeRelationships: (parent: EntityIdentifier, children: EntityIdentifier[]) => Promise<void>;
  diffRelationships: (
    parent: EntityIdentifier,
    children: EntityIdentifier[],
  ) => Promise<{
    childrenToAdd: EntityIdentifier[];
    childrenToRemove: EntityIdentifier[];
  }>;
  updateRelationships: (
    callingUser: CallingUser,
    parent: EntityIdentifier,
    children: EntityIdentifier[],
  ) => Promise<void>;
  removeAllRelationships: (entity: EntityIdentifier) => Promise<void>;
}

/**
 * Filters the given entity identifiers to only those of the given type, converting them to their original identifier
 * type.
 */
export const filterRelatedEntitiesOfType = <T extends OperationEntityName>(
  entities: EntityIdentifier[],
  requestedType: T,
): GetEntityIdentifier<T>[] =>
  entities
    .filter(({ type }) => type === requestedType)
    .map((entity) => identifierFromEntityIdentifier(requestedType, entity));

/**
 * Class for interacting with relationships in dynamodb
 */
export class RelationshipClient implements IRelationshipClient {
  // Singleton instance of the relationship client
  private static instance: IRelationshipClient | undefined;

  /**
   * Get an instance of the relationship client. Creates the instance with any default dependencies.
   * @param ddb dynamodb document client
   */
  /* istanbul ignore next */
  public static getInstance = (ddb: DynamoDB.DocumentClient = AwsDynamoDBDocumentClient()): IRelationshipClient => {
    if (!RelationshipClient.instance) {
      RelationshipClient.instance = new RelationshipClient(ddb);
    }
    return RelationshipClient.instance;
  };

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly relationshipStore: GenericDynamodbStore<RelationshipIdentifier, RelationshipIdentifier>;
  private readonly log: Logger;
  private readonly tableName: string;

  /**
   * Create an instance of the relationship client
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.tableName = process.env.RELATIONSHIP_TABLE_NAME!;
    this.relationshipStore = new GenericDynamodbStore<RelationshipIdentifier, RelationshipIdentifier>(
      ddb,
      this.tableName,
      true,
    );
    this.log = new Logger({
      tags: ['RelationshipClient', this.tableName],
    });
  }

  /**
   * Return all entities that relate to the given entity
   * @param entity the entity to retrieve relations of
   */
  public getRelatedEntities = async (entity: EntityIdentifier): Promise<EntityIdentifier[]> => {
    const entityId = entityIdentifierToString(entity);
    const relationships = (await paginatedRequest(
      this.ddb.query.bind(this.ddb),
      {
        TableName: this.tableName,
        KeyConditionExpression: '#key = :value',
        ExpressionAttributeNames: { '#key': 'left' },
        ExpressionAttributeValues: { ':value': entityId },
      },
      'Items',
      'LastEvaluatedKey',
      'ExclusiveStartKey',
    )) as RelationshipIdentifier[];
    return relationships.map(({ right }) => entityIdentifierFromString(right));
  };

  /**
   * Returns the related entities of the given type
   * @param entity the entity to get related entities for
   * @param requestedType only return related entities of this type
   */
  public getRelatedEntitiesOfType = async <T extends OperationEntityName>(
    entity: EntityIdentifier,
    requestedType: T,
  ): Promise<GetEntityIdentifier<T>[]> =>
    filterRelatedEntitiesOfType(await this.getRelatedEntities(entity), requestedType);

  private buildTwoWayRelationships = (
    parent: EntityIdentifier,
    children: EntityIdentifier[],
  ): RelationshipIdentifier[] => {
    const parentId = entityIdentifierToString(parent);
    const childrenIds = children.map((child) => entityIdentifierToString(child));

    return [
      ...childrenIds.map((left) => ({ left, right: parentId })),
      ...childrenIds.map((right) => ({ left: parentId, right })),
    ];
  };

  /**
   * Add relationships between the parent and every child
   * @param userId the user creating the relationships
   * @param parent the parent entity to relate to each child
   * @param children the entities to relate to the parent (children will not be related to one another)
   */
  public addRelationships = async ({ userId }: CallingUser, parent: EntityIdentifier, children: EntityIdentifier[]) => {
    const relationships = this.buildTwoWayRelationships(parent, children);
    this.log.info('Adding relationships', { relationships });
    await this.relationshipStore.batchPut(relationships, relationships, userId, true);
  };

  /**
   * Return the diff of the current relationships to the given relationships. Only diffs relationships of the types of
   * the given children.
   * @param parent the parent
   * @param children the children to diff against the current relationships
   */
  public diffRelationships = async (parent: EntityIdentifier, children: EntityIdentifier[]) => {
    // Limit the relationship diff to the types of the given children
    const childTypes = new Set(children.map(({ type }) => type));

    const existingChildrenIds = new Set(
      (await this.getRelatedEntities(parent)).map((entityIdentifier) => entityIdentifierToString(entityIdentifier)),
    );
    const childrenIds = new Set(children.map((entityIdentifier) => entityIdentifierToString(entityIdentifier)));

    const childrenToAdd = [...childrenIds]
      .filter((childId) => !existingChildrenIds.has(childId))
      .map((childId) => entityIdentifierFromString(childId));

    const childrenToRemove = [...existingChildrenIds]
      .filter((existingChildId) => !childrenIds.has(existingChildId))
      .map((childId) => entityIdentifierFromString(childId))
      // Filter to ensure we only remove children of the same type as the given children
      .filter((child) => childTypes.has(child.type));

    return { childrenToAdd, childrenToRemove };
  };

  /**
   * Updates the relationships for the parent to match the given relationships (ie resets relationships to the provided)
   * Will only update relationships of the same type as the children, leaving relationships to other entity types
   * untouched.
   * @param callingUser the user creating the relationships
   * @param parent the parent entity to relate to each child
   * @param children the entities to relate to the parent
   * @param type the type of relationship to filter by (ie only resets the relationships of that type)
   */
  public updateRelationships = async (
    callingUser: CallingUser,
    parent: EntityIdentifier,
    children: EntityIdentifier[],
  ) => {
    const { childrenToAdd, childrenToRemove } = await this.diffRelationships(parent, children);
    await Promise.all([
      this.addRelationships(callingUser, parent, childrenToAdd),
      this.removeRelationships(parent, childrenToRemove),
    ]);
  };

  /**
   * Remove relationships between the parent and the given entities
   * @param parent the parent to remove the relationship to
   * @param children the children to remove the relationship to
   */
  public removeRelationships = async (parent: EntityIdentifier, children: EntityIdentifier[]) => {
    const relationships = this.buildTwoWayRelationships(parent, children);
    this.log.info('Removing relationships', relationships);
    await this.relationshipStore.batchDeleteIfExists(relationships);
  };

  /**
   * Deletes all relationships to and from the entity
   * @param entity the entity to delete relationships for
   */
  public removeAllRelationships = async (entity: EntityIdentifier) => {
    await this.removeRelationships(entity, await this.getRelatedEntities(entity));
  };
}
