/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, PaginatedResponse } from '@ada/api';
import { GenericDynamodbStore, Machine } from '@ada/infra/src/common/services';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const { MACHINE_TABLE_NAME } = process.env;

export type MachineWithCreateUpdateDetails = Machine & CreateAndUpdateDetails;

type MachineIdentifier = Pick<Machine, 'machineId'>;

/**
 * The structure of a response when listing machine
 */
export interface ListMachinesResponse extends PaginatedResponse {
  readonly machines: MachineWithCreateUpdateDetails[];
  readonly error?: string;
}

/**
 * Class for interacting with identity machine in dynamodb
 */
export class MachineStore {
  // Singleton instance of the machine store
  private static instance: MachineStore | undefined;

  /**
   * Get an instance of the machine store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): MachineStore =>
    MachineStore.instance || new MachineStore(AwsDynamoDBDocumentClient());

  private readonly ddb: DynamoDB.DocumentClient;
  private readonly machineStore: GenericDynamodbStore<MachineIdentifier, Machine>;

  /**
   * Create an instance of the machine store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.machineStore = new GenericDynamodbStore<MachineIdentifier, Machine>(ddb, MACHINE_TABLE_NAME ?? '');
  }

  /**
   * Get a machine if present
   * @param machineId the id of the machine
   */
  public getMachine = (machineId: string): Promise<MachineWithCreateUpdateDetails | undefined> =>
    this.machineStore.get({ machineId });

  /**
   * Delete a machine if present
   * @param machineId the id of the machine
   */
  public deleteMachineIfExists = (machineId: string): Promise<MachineWithCreateUpdateDetails | undefined> =>
    this.machineStore.deleteIfExists({ machineId });

  /**
   * Create or update a machine
   * @param machineId the id of the machine to create/update
   * @param userId the id of the user performing the operation
   * @param machine the machine to write
   */
  public putMachine = async (
    machineId: string,
    userId: string,
    machine: Machine,
  ): Promise<MachineWithCreateUpdateDetails> => {
    return this.machineStore.put({ machineId }, userId, machine);
  };

  /**
   * List all machine
   * @param paginationParameters options for pagination
   */
  public listMachine = async (paginationParameters: PaginationParameters): Promise<ListMachinesResponse> => {
    const result = await this.machineStore.list(paginationParameters);

    return {
      machines: result.items,
      nextToken: result.nextToken,
      error: result.error,
    };
  };
}
