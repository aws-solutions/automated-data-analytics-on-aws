/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, Ontology, OntologyIdentifier, PaginatedResponse } from '@ada/api';
import {
  GenericDynamodbStore,
  batchTransactWrite,
  fetchPageWithQueryForHashKeyEquals,
  getCreateAndUpdateDetails,
  updateCounter,
} from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { ONTOLOGY_TABLE_NAME, ALIAS_TO_ONTOLOGY_TABLE_NAME } = process.env;

export type OntologyWithCreateUpdateDetails = Ontology & CreateAndUpdateDetails;

/**
 * The structure of an alias to ontology mapping entry in the alias to ontology table
 */
export interface OntologyAliasMapping {
  alias: string;
  ontologyId: string;
  ontologyNamespace: string;
}

type AliasIdentifier = Pick<OntologyAliasMapping, 'alias'>;

/**
 * The structure of a response when listing ontologies
 */
export interface ListOntologiesResponse extends PaginatedResponse {
  readonly ontologies: Ontology[];
  readonly error?: string;
}

/**
 * Class for interacting with ontology attributes in dynamodb
 */
export class OntologyStore {
  // Singleton instance of the ontology store
  private static instance: OntologyStore | undefined;

  /**
   * Get an instance of the ontology store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): OntologyStore =>
    OntologyStore.instance || new OntologyStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly ontologyStore: GenericDynamodbStore<OntologyIdentifier, Ontology>;
  private readonly aliasStore: GenericDynamodbStore<AliasIdentifier, OntologyAliasMapping>;

  /**
   * Create an instance of the ontology store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.ontologyStore = new GenericDynamodbStore<OntologyIdentifier, Ontology>(ddb, ONTOLOGY_TABLE_NAME ?? '');
    this.aliasStore = new GenericDynamodbStore<AliasIdentifier, OntologyAliasMapping>(
      ddb,
      ALIAS_TO_ONTOLOGY_TABLE_NAME ?? '',
    );
  }

  /**
   * Get an ontology attribute if present
   * @param ontologyId the id of the ontology attribute
   */
  public getOntology = (ontologyId: OntologyIdentifier): Promise<OntologyWithCreateUpdateDetails | undefined> => {
    return this.ontologyStore.get(ontologyId);
  };

  /**
   * Get an ontology alias if present
   * @param alias the alias name
   */
  public getAlias = async (alias: string): Promise<OntologyAliasMapping | undefined> =>
    (await this.batchGetAliases([alias]))[alias];

  /**
   * Retrieve the ontologies that map to the given aliases. Aliases that do not exist are omitted from the response.
   * @param aliases the alias names to retrieve
   */
  private batchGetAliases = (aliases: string[]): Promise<{ [alias: string]: OntologyAliasMapping }> => {
    return this.aliasStore.batchGet(
      aliases.map((alias) => ({ alias })),
      (mapping) => mapping.alias,
    );
  };

  /**
   * Returns a list of "clashing aliases", that is aliases in the given ontology that clash with aliases used by other
   * ontologies
   * @param ontologyIdToCheckForClashes the ontology id of the ontology to check
   * @param ontology the ontology to check
   */
  public getClashingAliases = async (
    ontologyIdToCheckForClashes: OntologyIdentifier,
    ontology: Ontology,
  ): Promise<OntologyAliasMapping[]> =>
    Object.values(await this.batchGetAliases(ontology.aliases.map((ontologyAlias) => ontologyAlias.name))).filter(
      ({ ontologyNamespace, ontologyId }) =>
        ontologyId !== ontologyIdToCheckForClashes.ontologyId &&
        ontologyNamespace === ontologyIdToCheckForClashes.ontologyNamespace,
    );

  /**
   * Create or update an ontology attribute
   * @param ontologyId the id of the ontology attribute to create/update
   * @param userId the id of the user performing the operation
   * @param ontology the ontology to write
   */
  public putOntology = async (
    ontologyId: OntologyIdentifier,
    userId: string,
    ontology: Ontology,
  ): Promise<OntologyWithCreateUpdateDetails> => {
    // First, retrieve the existing ontology if any
    const existingOntology = await this.getOntology(ontologyId);

    // Construct the ontology to write to dynamodb (including the appropriate create and update details)
    const createAndUpdateDetails = getCreateAndUpdateDetails(userId, existingOntology);
    const ontologyToWrite: OntologyWithCreateUpdateDetails = {
      ...ontology,
      ...createAndUpdateDetails,
      ontologyId: ontologyId.ontologyId,
      ontologyNamespace: ontologyId.ontologyNamespace,
    };

    // We must keep our alias mapping table in sync, so construct sets of the existing and updated aliases
    const existingAliases = existingOntology
      ? new Set(existingOntology.aliases.map((alias) => alias.name))
      : new Set<string>();
    const updatedAliases = new Set(ontologyToWrite.aliases.map((alias) => alias.name));

    // Find any new aliases to add, and any old aliases to remove
    const aliasesToAdd = [...updatedAliases].filter((alias) => !existingAliases.has(alias));
    const aliasesToRemove = [...existingAliases].filter((alias) => !updatedAliases.has(alias));

    // Update the ontology and aliases in a single transaction where possible. Transactions support up to 25 items, so
    // for adding/removing more than 25 items we accept the risk of orphaned aliases
    await batchTransactWrite(this.ddb, [
      {
        Put: {
          TableName: ONTOLOGY_TABLE_NAME ?? '',
          Item: ontologyToWrite,
          ...(existingOntology
            ? {
                ConditionExpression: `updatedTimestamp = :updatedTimestamp`,
                ExpressionAttributeValues: {
                  ':updatedTimestamp': existingOntology.updatedTimestamp,
                },
              }
            : { ConditionExpression: 'attribute_not_exists(updatedTimestamp)' }),
        },
      },
      ...aliasesToAdd.map((alias) => ({
        Put: {
          TableName: ALIAS_TO_ONTOLOGY_TABLE_NAME ?? '',
          Item: {
            alias,
            ...ontologyId,
          },
        },
      })),
      ...aliasesToRemove.map((alias) => ({
        Delete: {
          TableName: ALIAS_TO_ONTOLOGY_TABLE_NAME ?? '',
          Key: {
            alias,
          },
        },
      })),
      updateCounter(ALIAS_TO_ONTOLOGY_TABLE_NAME ?? '', aliasesToAdd.length - aliasesToRemove.length),
      ...(existingOntology ? [] : [updateCounter(ONTOLOGY_TABLE_NAME ?? '', 1)]),
    ]);

    // Return our updated ontology
    return ontologyToWrite;
  };

  /**
   * Delete the ontology attribute and all its aliases if it exists
   * @param ontologyId the id of the ontology to delete
   */
  public deleteOntologyIfExists = async (
    ontologyId: OntologyIdentifier,
  ): Promise<OntologyWithCreateUpdateDetails | undefined> => {
    const deletedOntology = await this.ontologyStore.deleteIfExists(ontologyId);

    if (deletedOntology) {
      await this.aliasStore.batchDeleteIfExists(deletedOntology.aliases.map(({ name }) => ({ alias: name })));
    }

    return deletedOntology;
  };

  /**
   * List all ontologies in the ontologyStore
   * @param paginationParameters options for pagination
   * @returns
   */
  public listOntologies = async (paginationParameters: PaginationParameters): Promise<ListOntologiesResponse> => {
    const result = await this.ontologyStore.list(paginationParameters);
    return {
      ontologies: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };

  /**
   * List all ontologies in the ontologyNamespace
   * @param ontologyNamespace the ontologyNamespace of ontologies to list
   * @param paginationParameters options for pagination
   */
  public listOntologiesInNamespace = async (
    ontologyNamespace: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListOntologiesResponse> => {
    const result = await this.ontologyStore.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('ontologyNamespace', ontologyNamespace),
    );
    return {
      ontologies: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };
}
