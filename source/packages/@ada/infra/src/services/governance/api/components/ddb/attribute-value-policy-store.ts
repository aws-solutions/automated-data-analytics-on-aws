/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributePolicyIdentifier, AttributeValuePolicy, CreateAndUpdateDetails } from '@ada/api';
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';

import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import { buildNamespaceAndAttributeId } from '@ada/common';

// Table names are passed as environment variables defined in the CDK infrastructure
const ATTRIBUTE_VALUE_POLICY_TABLE_NAME = process.env.ATTRIBUTE_VALUE_POLICY_TABLE_NAME ?? '';
const ATTRIBUTE_VALUE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME = process.env.ATTRIBUTE_VALUE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME ?? '';

export type AttributeValuePolicyWithCreateUpdateDetails = AttributeValuePolicy & CreateAndUpdateDetails;

/**
 * Class for interacting with attribute value policies in dynamodb
 */
export class AttributeValuePolicyStore {
  // Singleton instance of the policy store
  private static instance: AttributeValuePolicyStore | undefined;
  private readonly ddb: DynamoDB.DocumentClient;

  /**
   * Get an instance of the attribute value policy store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): AttributeValuePolicyStore =>
    AttributeValuePolicyStore.instance || new AttributeValuePolicyStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<AttributePolicyIdentifier, AttributeValuePolicy>;

  /**
   * Create an instance of the attribute value policy store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.ddb = ddb;
    this.store = new GenericDynamodbStore<AttributePolicyIdentifier, AttributeValuePolicy>(
      ddb,
      ATTRIBUTE_VALUE_POLICY_TABLE_NAME,
    );
  }

  /**
   * Get an attribute value policy if present
   * @param attributeId the id of the attribute to which the policy applies
   * @param group the id of the group to which the policy applies
   */
  public getAttributeValuePolicy = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<AttributeValuePolicyWithCreateUpdateDetails | undefined> => {
    return this.store.get({
      namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
      group,
    });
  };

  /**
   * Create or update an attribute value policy
   * @param attributeId the id of the attribute to which the policy applies
   * @param group the id of the group to which the policy applies
   * @param userId the id of the user performing the operation
   * @param attributeValuePolicy the policy to write
   */
  public putAttributeValuePolicy = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
    userId: string,
    attributeValuePolicy: AttributeValuePolicy,
  ): Promise<AttributeValuePolicyWithCreateUpdateDetails> => {
    return this.store.put(
      { namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId), group },
      userId,
      attributeValuePolicy,
    );
  };

  /**
   * Create or update a batch of attribute value policies
   * @param userId the id of the user performing the operation
   * @param attributeValuePolicies the policies to write
   */
  public batchPutAttributeValuePolicy = (
    userId: string,
    attributeValuePolicies: AttributeValuePolicy[],
    forceUpdate: boolean,
  ): Promise<AttributeValuePolicyWithCreateUpdateDetails[]> => {
    return this.store.batchPut(
      attributeValuePolicies.map(({ namespaceAndAttributeId, group }) => ({ namespaceAndAttributeId, group })),
      attributeValuePolicies,
      userId,
      forceUpdate,
    );
  };

  /**
   * Delete an attribute value policy if it exists
   * @param ontologyNamespace namespace of ontology attribute
   * @param attributeId attribute id of the policy to delete
   * @param group group id of the policy to delete
   */
  public deleteAttributeValuePolicyIfExists = (
    ontologyNamespace: string,
    attributeId: string,
    group: string,
  ): Promise<AttributeValuePolicyWithCreateUpdateDetails | undefined> => {
    return this.store.deleteIfExists({
      namespaceAndAttributeId: buildNamespaceAndAttributeId(ontologyNamespace, attributeId),
      group,
    });
  };

  /**
   * Delete a batch of attribute value policies
   * @param attributeValuePolicyIdentifiers the attribute policies to delete
   */
  public batchDeleteAttributeValuePolicy = (
    attributeValuePolicyIdentifiers: AttributePolicyIdentifier[],
  ): Promise<(AttributeValuePolicyWithCreateUpdateDetails | undefined)[]> => {
    return this.store.batchDeleteIfExists(attributeValuePolicyIdentifiers);
  };

  /**
   * Return attribute value policies that has the namespaceAndAttributeId provided as input
   * @param ontologyNamespace the ontologyNamespace value
   * @param attributeId the attributeId value
   * @returns attribute value policies for that namespaceAndAttributeId
   */
  public getAttributeValuePoliciesByAttributeId = async (ontologyNamespace: string,
    attributeId: string,
  ): Promise<AttributeValuePolicy[]> => {
    const res = await fetchPageWithQueryForHashKeyEquals('namespaceAndAttributeId', buildNamespaceAndAttributeId(ontologyNamespace, attributeId), {
      indexName: ATTRIBUTE_VALUE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME,
    })({
      ddb: this.ddb,
      limit: 1000,
      tableName: ATTRIBUTE_VALUE_POLICY_TABLE_NAME ?? '',
    });

    // the clientId is the partition key of the GSI, we are expecting only one item
    return res.Items || [];
  };


  /**
   * Get the sql clause that should be applied for each given attribute for the given group
   * @param namespaceAndAttributeIds the attribute ids to retrieve
   * @param group the group to retrieve clauses for
   */
  public getSqlClausesForAttributes = async (
    namespaceAndAttributeIds: string[],
    group: string,
  ): Promise<{ [namespaceAndAttributeId: string]: string }> => {
    const policiesByNamespaceAndAttributeId = await this.store.batchGet(
      namespaceAndAttributeIds.map((namespaceAndAttributeId) => ({ namespaceAndAttributeId, group })),
      (policy) => policy.namespaceAndAttributeId,
    );
    return Object.fromEntries(
      Object.keys(policiesByNamespaceAndAttributeId).map((namespaceAndAttributeId) => [
        namespaceAndAttributeId,
        policiesByNamespaceAndAttributeId[namespaceAndAttributeId].sqlClause,
      ]),
    );
  };
}
