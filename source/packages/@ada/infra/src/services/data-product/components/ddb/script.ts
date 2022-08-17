/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import { PaginatedResponse, Script, ScriptEntity, ScriptIdentifier } from '@ada/api';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const SCRIPT_TABLE_NAME = process.env.SCRIPT_TABLE_NAME ?? '';

/**
 * The structure of a response when listing scripts
 */
export interface ListScriptsResponse extends PaginatedResponse {
  readonly scripts: Script[];
  readonly error?: string;
}

/**
 * Class for interacting with scripts in dynamodb
 */
export class ScriptStore {
  // Singleton instance of the script store
  private static instance: ScriptStore | undefined;

  /**
   * Get an instance of the script store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): ScriptStore => ScriptStore.instance || new ScriptStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<ScriptIdentifier, Script>;

  /**
   * Create an instance of the script store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<ScriptIdentifier, Script>(ddb, SCRIPT_TABLE_NAME);
  }

  /**
   * Get a script if present
   * @param scriptId the id of the script
   */
  public getScript = (scriptId: ScriptIdentifier): Promise<ScriptEntity | undefined> => {
    return this.store.get(scriptId);
  };

  /**
   * Create or update a script
   * @param scriptId the id of the script to create/update
   * @param userId the id of the user performing the operation
   * @param script the script to write
   */
  public putScript = async (scriptId: ScriptIdentifier, userId: string, script: Script): Promise<ScriptEntity> => {
    return this.store.put(scriptId, userId, script);
  };

  /**
   * Delete a script if it exists
   * @param scriptId the script to delete
   */
  public deleteScriptIfExists = (scriptId: ScriptIdentifier): Promise<ScriptEntity | undefined> =>
    this.store.deleteIfExists(scriptId);

  /**
   * List all scripts in the store
   * @param paginationParameters options for pagination
   */
  public listScripts = async (paginationParameters: PaginationParameters): Promise<ListScriptsResponse> => {
    const result = await this.store.list(paginationParameters);
    return { scripts: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };

  /**
   * List all scripts in the namespace
   * @param namespace the namespace of scripts to list
   * @param paginationParameters options for pagination
   */
  public listScriptsInNamespace = async (
    namespace: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListScriptsResponse> => {
    const result = await this.store.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('namespace', namespace),
    );
    return { scripts: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };
}
