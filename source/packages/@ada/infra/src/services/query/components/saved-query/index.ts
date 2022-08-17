/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { CallingUser, ReservedDataProducts, ReservedDomains } from '@ada/common';
import { SavedQuery, SavedQueryIdentifier } from '@ada/api';
import { VError } from 'verror';

/**
 * Renders a query identifier as it would be addressed in a query
 */
export const toQueryAddressedAs = ({ namespace, queryId }: SavedQueryIdentifier, callingUser: CallingUser): string =>
  `${isPrivateNamespace(callingUser, namespace) ? ReservedDomains.MY : namespace}.${
    ReservedDataProducts.QUERIES
  }.${queryId}`;

/**
 * Get the queries referenced by
 */
export const getSavedQueries = async (
  api: ApiClient,
  queriesInQuery: SavedQueryIdentifier[],
): Promise<SavedQuery[]> => {
  const results: (SavedQuery | Error)[] = await Promise.all(
    queriesInQuery.map(async (savedQueryIdentifier) => {
      const { namespace, queryId } = savedQueryIdentifier;
      try {
        console.log('Retrieving query with namespace', namespace, 'and queryId', queryId);
        return await api.getQuerySavedQuery(savedQueryIdentifier);
      } catch (e: any) {
        if ('json' in e) {
          return new Error((await e.json()).message);
        }
        return new Error(
          e.message || `Could not get referenced query with namespace ${namespace} and queryId ${queryId}`,
        );
      }
    }),
  );

  const savedQueries = results.filter((result) => !(result instanceof Error)) as SavedQuery[];
  const errors = results.filter((result) => result instanceof Error) as Error[];

  if (errors.length > 0) {
    throw new VError(
      { name: 'GetSavedQueryError', cause: VError.errorFromList(errors) },
      errors.map((e) => e.message).join(', '),
    );
  }
  return savedQueries;
};

/**
 * Returns true if the namespace is private for the calling user
 * @param userId the calling user
 * @param namespace the namespace to check
 */
export const isPrivateNamespace = ({ userId }: CallingUser, namespace: string): boolean => userId === namespace;

/**
 * Validates the given namespace is either a public namespace, or a private namespace for the calling user.
 * Throws a 404 for a missing domain otherwise, eg if a user requests another user's private query
 */
export const validateNamespace = async (api: ApiClient, callingUser: CallingUser, namespace: string) => {
  if (!isPrivateNamespace(callingUser, namespace)) {
    // Make sure the query has been saved against an existing domain. This will throw if it's a 404
    await api.getDataProductDomain({
      domainId: namespace,
    });
    console.log(`Valid non-private namespace: ${namespace}`);
    // NOTE: Consider governance of saving to a domain
  }
};
