/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributePolicy, AttributePolicyIdentifier, CreateAndUpdateDetails, LensEnum } from '@ada/api';
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import { buildNamespaceAndAttributeId } from '@ada/common';

// Table names are passed as environment variables defined in the CDK infrastructure
const ATTRIBUTE_POLICY_TABLE_NAME = process.env.ATTRIBUTE_POLICY_TABLE_NAME ?? '';
const ATTRIBUTE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME= process.env.ATTRIBUTE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME ?? '';

export type AttributePolicyWithCreateUpdateDetails = AttributePolicy & CreateAndUpdateDetails;

/**
 * Class for interacting with attribute policies in dynamodb
 */
export class AttributePolicyStore {
  // Singleton instance of the policy store
  private static instance: AttributePolicyStore | undefined;

  /**
   * Get an instance of the attribute policy store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): AttributePolicyStore =>
    AttributePolicyStore.instance || new AttributePolicyStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<AttributePolicyIdentifier, AttributePolicy>;
  private readonly ddb: DynamoDB.DocumentClient;
  /**
   * Create an instance of the attribute policy store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.store = new GenericDynamodbStore<AttributePolicyIdentifier, AttributePolicy>(
      ddb,
      ATTRIBUTE_POLICY_TABLE_NAME,
    );
  }

  /**
   * Get an attribute policy if present
   * @param attributeId the id of the attribute to which the policy applies
   * @param group the id of the group to which the policy applies
   */
  public getAttributePolicy = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<AttributePolicyWithCreateUpdateDetails | undefined> => {
    return this.store.get({
      namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
      group,
    });
  };

  /**
   * Return attribute policies that has the namespaceAndAttributeId provided as input
   * @param ontologyNamespace the ontologyNamespace value
   * @param attributeId the attributeId value
   * @returns attribute policies for that namespaceAndAttributeId
   */
  public getAttributePoliciesByAttributeId = async (ontologyNamespace: string,
    attributeId: string,
  ): Promise<AttributePolicy[]> => {
    const res = await fetchPageWithQueryForHashKeyEquals('namespaceAndAttributeId', buildNamespaceAndAttributeId(ontologyNamespace, attributeId), {
      indexName: ATTRIBUTE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME,
    })({
      ddb: this.ddb,
      limit: 1000,
      tableName: ATTRIBUTE_POLICY_TABLE_NAME ?? '',
    });

    // the clientId is the partition key of the GSI, we are expecting only one item
    return res.Items || [];
  };

  /**
   * Create or update an attribute policy
   * @param attributeId the id of the attribute to which the policy applies
   * @param group the id of the group to which the policy applies
   * @param userId the id of the user performing the operation
   * @param attributePolicy the policy to write
   */
  public putAttributePolicy = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
    userId: string,
    attributePolicy: AttributePolicy,
  ): Promise<AttributePolicyWithCreateUpdateDetails> => {
    return this.store.put(
      { namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId), group },
      userId,
      attributePolicy,
    );
  };

  /**
   * Create or update a batch of attribute policies
   * @param userId the id of the user performing the operation
   * @param attributePolicies the policies to write
   * @param forceUpdate force update
   */
  public batchPutAttributePolicy = (
    userId: string,
    attributePolicies: AttributePolicy[],
    forceUpdate?: boolean,
  ): Promise<AttributePolicyWithCreateUpdateDetails[]> => {
    // todo: this is a simple refactoring to force update when the updated timestamps are not returned through getLensIdsForAttributes. need to update both
    return this.store.batchPut(
      attributePolicies.map(({ namespaceAndAttributeId, group }) => ({ namespaceAndAttributeId, group })),
      attributePolicies,
      userId,
      forceUpdate,
    );
  };

  /**
   * Delete a batch of attribute policies
   * @param attributePolicyIdentifiers the attribute policies to delete
   */
  public batchDeleteAttributePolicy = (
    attributePolicyIdentifiers: AttributePolicyIdentifier[],
  ): Promise<(AttributePolicyWithCreateUpdateDetails | undefined)[]> => {
    return this.store.batchDeleteIfExists(attributePolicyIdentifiers);
  };

  /**
   * Delete an attribute policy if it exists
   * @param attributeId attribute id of the policy to delete
   * @param group group id of the policy to delete
   */
  public deleteAttributePolicyIfExists = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<AttributePolicyWithCreateUpdateDetails | undefined> => {
    return this.store.deleteIfExists({
      namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
      group,
    });
  };

  /**
   * Get the lens that should be applied for each given attribute for the given group
   * @param attributeIds the attribute ids to retrieve
   * @param group the group to retrieve policies for
   */
  public getLensIdsForAttributes = async (
    namespaceAndAttributeIds: string[],
    group: string,
  ): Promise<{ [namespaceAndAttributeId: string]: LensEnum }> => {
    const policiesByAttributeId = await this.store.batchGet(
      namespaceAndAttributeIds.map((namespaceAndAttributeId) => ({ namespaceAndAttributeId, group })),
      (policy) => policy.namespaceAndAttributeId,
    );
    return Object.fromEntries(
      Object.keys(policiesByAttributeId).map((namespaceAndAttributeId) => [
        namespaceAndAttributeId,
        policiesByAttributeId[namespaceAndAttributeId].lensId,
      ]),
    );
  };
}
