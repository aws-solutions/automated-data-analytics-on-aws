/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { CreateAndUpdateDetails, DataProductIdentifier, DefaultLensPolicy } from '@ada/api';
import { GenericDynamodbStore } from '@ada/microservice-common';

// Table names are passed as environment variables defined in the CDK infrastructure
const DEFAULT_LENS_POLICY_TABLE_NAME = process.env.DEFAULT_LENS_POLICY_TABLE_NAME ?? '';

export type DefaultLensPolicyWithCreateUpdateDetails = DefaultLensPolicy & CreateAndUpdateDetails;

/**
 * Class for interacting with attribute policies in dynamodb
 */
export class DefaultLensPolicyStore {
  // Singleton instance of the policy store
  private static instance: DefaultLensPolicyStore | undefined;

  /**
   * Get an instance of the attribute policy store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): DefaultLensPolicyStore =>
    DefaultLensPolicyStore.instance || new DefaultLensPolicyStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<DataProductIdentifier, DefaultLensPolicy>;

  /**
   * Create an instance of the default lens policy store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<DataProductIdentifier, DefaultLensPolicy>(
      ddb,
      DEFAULT_LENS_POLICY_TABLE_NAME,
    );
  }

  /**
   * Get a default lens policy if present
   * @param domainId the id of the domain to which the policy applies
   * @param dataProductId the id of the data product to which the policy applies
   */
  public getDefaultLensPolicy = (
    domainId: string,
    dataProductId: string,
  ): Promise<DefaultLensPolicyWithCreateUpdateDetails | undefined> => {
    return this.store.get({ domainId, dataProductId });
  };

  /**
   * Create or update a default lens policy
   * @param domainId the id of the domain to which the policy applies
   * @param dataProductId the id of the data product to which the policy applies
   * @param userId the id of the user performing the operation
   * @param defaultLensPolicy the policy to write
   */
  public putDefaultLensPolicy = (
    domainId: string,
    dataProductId: string,
    userId: string,
    defaultLensPolicy: DefaultLensPolicy,
  ): Promise<DefaultLensPolicyWithCreateUpdateDetails> => {
    return this.store.put({ domainId, dataProductId }, userId, defaultLensPolicy);
  };

  /**
   * Delete a default lens policy if it exists
   * @param domainId domain id of the policy to delete
   * @param dataProductId data product id of the policy to delete
   */
  public deleteDefaultLensPolicyIfExists = (
    domainId: string,
    dataProductId: string,
  ): Promise<DefaultLensPolicyWithCreateUpdateDetails | undefined> => {
    return this.store.deleteIfExists({ domainId, dataProductId });
  };
}
