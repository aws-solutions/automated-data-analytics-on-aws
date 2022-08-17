/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, DataProductIdentifier, DataProductPolicy } from '@ada/api';
import { GenericDynamodbStore } from '@ada/microservice-common';

// Table names are passed as environment variables defined in the CDK infrastructure
const DATA_PRODUCT_POLICY_TABLE_NAME = process.env.DATA_PRODUCT_POLICY_TABLE_NAME ?? '';

export type DataProductPolicyWithCreateUpdateDetails = DataProductPolicy & CreateAndUpdateDetails;

/**
 * Class for interacting with Data Product Policies in dynamodb
 */
export class DataProductPolicyStore {
  // Singleton instance of the data product policy store
  private static instance: DataProductPolicyStore | undefined;

  /**
   * Get an instance of the data product policy store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): DataProductPolicyStore =>
    DataProductPolicyStore.instance || new DataProductPolicyStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<DataProductIdentifier, DataProductPolicy>;

  /**
   * Create an instance of the data product policy store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<DataProductIdentifier, DataProductPolicy>(
      ddb,
      DATA_PRODUCT_POLICY_TABLE_NAME,
    );
  }

  /**
   * Get a data product policy if present
   * @param domainId the id of the domain in which the data product resides
   * @param dataProductId the id of the data product policy
   */
  public getDataProductPolicy = (
    domainId: string,
    dataProductId: string,
  ): Promise<DataProductPolicyWithCreateUpdateDetails | undefined> => {
    return this.store.get({ domainId, dataProductId });
  };

  /**
   * Create or update a data product policy attribute
   * @param domainId the id of the domain in which the data product resides
   * @param dataProductId the id of the data product to create/update
   * @param userId the id of the user performing the operation
   * @param dataProductPolicy the data product to write
   */
  public putDataProductPolicy = (
    domainId: string,
    dataProductId: string,
    userId: string,
    dataProductPolicy: DataProductPolicy,
  ): Promise<DataProductPolicyWithCreateUpdateDetails> => {
    return this.store.put({ domainId, dataProductId }, userId, dataProductPolicy);
  };

  /**
   * Delete a data product policy if present
   * @param domainId the id of the domain in which the data product resides
   * @param dataProductId the id of the data product policy
   */
  public deleteDataProductPolicyIfExists = (
    domainId: string,
    dataProductId: string,
  ): Promise<DataProductPolicyWithCreateUpdateDetails | undefined> => {
    return this.store.deleteIfExists({ domainId, dataProductId });
  };
}
