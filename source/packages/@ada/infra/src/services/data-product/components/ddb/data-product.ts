/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, DataProduct, DataProductIdentifier, PaginatedResponse } from '@ada/api';
import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';

export type DataProductWithCreateUpdateDetails = DataProduct & CreateAndUpdateDetails;

/**
 * The structure of a response when listing dataProducts
 */
export interface ListDataProductsResponse extends PaginatedResponse {
  readonly dataProducts: DataProduct[];
  readonly error?: string;
}

/**
 * Class for interacting with Data Products in dynamodb
 */
export class DataProductStore {
  // Singleton instance of the data product store
  private static instance: DataProductStore | undefined;

  /**
   * Get an instance of the data product store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): DataProductStore =>
    DataProductStore.instance || new DataProductStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<DataProductIdentifier, DataProduct>;

  /**
   * Create an instance of the data product store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<DataProductIdentifier, DataProduct>(
      ddb,
      process.env.DATA_PRODUCT_TABLE_NAME!,
    );
  }

  /**
   * Get a data product if present
   * @param domainId the id of the domain in which the data product resides
   * @param dataProductId the id of the data product
   */
  public getDataProduct = (
    domainId: string,
    dataProductId: string,
  ): Promise<DataProductWithCreateUpdateDetails | undefined> => {
    return this.store.get({ domainId, dataProductId });
  };

  /**
   * Create or update a data product attribute
   * @param domainId the id of the domain in which the data product resides
   * @param dataProductId the id of the data product to create/update
   * @param userId the id of the user performing the operation
   * @param dataProduct the data product to write
   */
  public putDataProduct = (
    domainId: string,
    dataProductId: string,
    userId: string,
    dataProduct: DataProduct,
  ): Promise<DataProductWithCreateUpdateDetails> => {
    return this.store.put({ domainId, dataProductId }, userId, dataProduct);
  };

  /**
   * Delete a data product if it exists
   * @param domainId the domain in which the data product resides
   * @param dataProductId the data product to delete
   */
  public deleteDataProductIfExists = (
    domainId: string,
    dataProductId: string,
  ): Promise<DataProductWithCreateUpdateDetails | undefined> => this.store.deleteIfExists({ domainId, dataProductId });

  /**
   * List all data products for the given domain
   * @param domainId the domain to fetch data products for
   * @param paginationParameters options for pagination
   */
  public listDataProducts = async (
    domainId: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListDataProductsResponse> => {
    const result = await this.store.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('domainId', domainId),
    );
    return {
      dataProducts: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };

  /**
   * List all data products across all domains, following all pagination
   */
  public listAllDataProducts = (): Promise<DataProduct[]> => this.store.scanAll();
}
