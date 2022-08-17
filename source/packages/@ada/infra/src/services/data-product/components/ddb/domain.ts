/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { Domain, DomainEntity, DomainIdentifier, PaginatedResponse } from '@ada/api';
import { GenericDynamodbStore } from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';

// Table names are passed as environment variables defined in the CDK infrastructure
const DOMAIN_TABLE_NAME = process.env.DOMAIN_TABLE_NAME ?? '';

export type DomainWithCreateUpdateDetails = DomainEntity;

/**
 * The structure of a response when listing domains
 */
export interface ListDomainsResponse extends PaginatedResponse {
  readonly domains: Domain[];
  readonly error?: string;
}

/**
 * Class for interacting with Domains in dynamodb
 */
export class DomainStore {
  // Singleton instance of the domain store
  private static instance: DomainStore | undefined;

  /**
   * Get an instance of the domain store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): DomainStore => DomainStore.instance || new DomainStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<DomainIdentifier, Domain>;

  /**
   * Create an instance of the domain store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<DomainIdentifier, Domain>(ddb, DOMAIN_TABLE_NAME);
  }

  /**
   * Get a domain if present
   * @param domainId the id of the domain
   */
  public getDomain = (domainId: string): Promise<DomainWithCreateUpdateDetails | undefined> => {
    return this.store.get({ domainId });
  };

  /**
   * Create or update a domain
   * @param domainId the id of the domain to create/update
   * @param userId the id of the user performing the operation
   * @param domain the domain to write
   */
  public putDomain = (domainId: string, userId: string, domain: Domain): Promise<DomainWithCreateUpdateDetails> => {
    return this.store.put({ domainId }, userId, domain);
  };

  /**
   * Delete a domain if it exists
   * @param domainId id of the domain to delete
   */
  public deleteDomainIfExists = (domainId: string): Promise<DomainWithCreateUpdateDetails | undefined> =>
    this.store.deleteIfExists({ domainId });

  /**
   * List all domains in the store
   * @param paginationParameters options for pagination
   */
  public listDomains = async (paginationParameters: PaginationParameters): Promise<ListDomainsResponse> => {
    const result = await this.store.list(paginationParameters);
    return { domains: result.items, nextToken: result.nextToken, totalItems: result.totalItems, error: result.error };
  };
}
