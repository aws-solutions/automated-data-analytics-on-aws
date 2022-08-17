/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as _ from 'lodash';
import { ApiClient } from '@ada/api-client-lambda';
import { CachedQueryStore } from '../ddb/cached-query';
import {
  CallingUser,
  DataProductAccess,
  LensIds,
  ReservedDataProducts,
  ReservedDomains,
  buildNamespaceAndAttributeId,
  buildUniqOntology,
  computeUniqueHash,
  getLeastRestrictiveLens,
  getLensRestrictiveness,
  getUdfsForLens,
} from '@ada/common';
import {
  ColumnMetadata,
  DataProduct,
  DataProductIdentifier,
  DataSet,
  DefaultLensPolicy,
  GovernedColumnMetadata,
  GovernedDataProductEntity,
  GovernedDataSets,
  OntologyEntity,
  PostQueryParseRenderDiscoverResponse,
  PostQueryParseRenderDiscoverResponseTables,
  Query,
  QueryRewriteInput,
  QueryRewriteInputColumns,
  ReferencedDataSetIdentifier,
  SavedQuery,
  SavedQueryIdentifier,
} from '@ada/api';
import { getDefaultDataSetId } from '../lambda';
import { getSavedQueries, toQueryAddressedAs } from '../saved-query';

export const ALLOWED_QUERY_DATA_PRODUCT_ACCESS_LEVELS = [DataProductAccess.FULL, DataProductAccess.READ_ONLY];

enum QueryReferenceType {
  DATA_SET = 'data-set',
  QUERY = 'query',
  SOURCE_DATA_SET = 'source-data-set',
}

interface QueryReference {
  type: QueryReferenceType;
  identifierParts: string[];
}

export const getUniqueDataProductIdentifiers = (referencesInQuery: QueryReference[]): DataProductIdentifier[] =>
  _.uniqWith(
    referencesInQuery.map(({ identifierParts: [domainId, dataProductId] }) => ({ domainId, dataProductId })),
    _.isEqual,
  );

export const getUniqueSavedQueryIdentifiers = (
  referencesInQuery: QueryReference[],
  { userId }: CallingUser,
): SavedQueryIdentifier[] =>
  _.uniqWith(
    referencesInQuery.map(({ identifierParts: [namespace, , queryId] }) => ({
      namespace: namespace === ReservedDomains.MY ? userId : namespace,
      queryId,
    })),
    _.isEqual,
  );

/**
 * Get the data product details for data products that the user has access to
 * @param api api client
 * @param dataProductsInQuery the data products found from the query
 */
export const getDataProductsInQuery = async (
  api: ApiClient,
  dataProductsInQuery: DataProductIdentifier[],
): Promise<GovernedDataProductEntity[]> => {
  const results: (GovernedDataProductEntity | Error)[] = await Promise.all(
    dataProductsInQuery.map(async ({ domainId, dataProductId }) => {
      // Get data product api is responsible for data product level governance (ie does data product policy permit read access)
      try {
        return await api.getDataProductDomainDataProduct({ domainId, dataProductId });
      } catch (e: any) {
        if ('json' in e) {
          return new Error((await e.json()).message);
        }
        return new Error(e.message || `Could not get data product ${domainId}.${dataProductId}`);
      }
    }),
  );

  const dataProducts = results.filter((result) => !(result instanceof Error)) as GovernedDataProductEntity[];
  const errors = results.filter((result) => result instanceof Error) as Error[];

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(', '));
  }
  return dataProducts;
};

export interface QueriedDataSet extends ReferencedDataSetIdentifier {
  dataSet: DataSet;
}

/**
 * Return the data sets involved in the query, or an error if referencing a dataset that doesn't exist
 * @param referencedDataSets datasets referenced in the query
 * @param dataProducts data products involved in the query
 */
export const getDataSetsInQuery = (
  referencedDataSets: QueryReference[],
  dataProducts: { [id: string]: DataProduct },
): QueriedDataSet[] => {
  const results: (QueriedDataSet | Error)[] = referencedDataSets.map((queryReference) => {
    const {
      type,
      identifierParts: [domainId, dataProductId, addressedDataSetId],
    } = queryReference;
    const dataProduct = dataProducts[`${domainId}.${dataProductId}`];

    // Pick the dataset to query from source if requested
    const _dataSets =
      type === QueryReferenceType.SOURCE_DATA_SET ? dataProduct.sourceDataSets || {} : dataProduct.dataSets;

    const dataSetIds = Object.keys(_dataSets);
    if (dataSetIds.length === 0) {
      return new Error(`No datasets were found to query for data product ${dataProduct.dataProductId}`);
    }

    const dataSetId = addressedDataSetId || getDefaultDataSetId(dataSetIds);

    if (!dataSetId) {
      return new Error(
        `Must explicitly specify the dataset to query since there are multiple datasets: ${dataSetIds.join(', ')}`,
      );
    }

    const dataSet = _dataSets[dataSetId];

    if (!dataSet) {
      return new Error(
        `Could not find a dataset with name ${dataSetId}. Available datasets are ${dataSetIds.join(', ')}`,
      );
    }

    return {
      domainId,
      dataProductId,
      dataSetId,
      addressedAs: toAddressedAs(queryReference),
      dataSet,
    };
  });

  const dataSets = results.filter((result) => !(result instanceof Error)) as QueriedDataSet[];
  const errors = results.filter((result) => result instanceof Error) as Error[];

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(', '));
  }
  return dataSets;
};

const unpackAddressedAs = (addressedAs: string): PostQueryParseRenderDiscoverResponseTables => {
  const identifierParts = addressedAs.split('.');
  return { identifierParts };
};

const toAddressedAs = ({ type, identifierParts }: QueryReference): string => {
  const parts: string[] = [];
  if (type === QueryReferenceType.SOURCE_DATA_SET) {
    parts.push(ReservedDomains.SOURCE);
  }
  return parts.concat(identifierParts).join('.');
};

/**
 * Return the default lens policy if it exists, or undefined if it does not
 * @param api api client
 * @param domainId domain id to retrieve policy for
 * @param dataProductId data product id to retrieve policy for
 */
export const getDefaultLensPolicyIfExists = async (
  api: ApiClient,
  domainId: string,
  dataProductId: string,
): Promise<DefaultLensPolicy | undefined> => {
  try {
    return await api.getGovernancePolicyDefaultLensDomainDataProduct({
      domainId,
      dataProductId,
    });
  } catch (e: any) {
    // When not found, just return undefined
    if (e?.status === 404) {
      return undefined;
    }
    throw e;
  }
};

/**
 * Returns all unique ontology attributes from the datasets involved in the query
 * @param dataSetsInQuery the datasets in the query
 */
const getUniqueOntologyAttributeIds = (dataSetsInQuery: QueriedDataSet[]): string[] =>
  _.uniq(
    dataSetsInQuery.flatMap(({ dataSet: { columnMetadata } }) =>
      Object.values(columnMetadata).flatMap((column) =>
        column.ontologyNamespace && column.ontologyAttributeId
          ? [buildNamespaceAndAttributeId(column.ontologyNamespace, column.ontologyAttributeId)]
          : [],
      ),
    ),
  );

/**
 * Build the columns to be sent to rewrite the query with the lenses applied.
 * Columns are returned ordered by their sortOrder (if present)
 * @param columnMetadata details about the dataset columns
 */
const buildColumnsForDataSet = (columnMetadata: {
  [name: string]: GovernedColumnMetadata;
}): QueryRewriteInputColumns[] =>
  _.orderBy(Object.entries(columnMetadata), ([, { sortOrder }]) => sortOrder)
    // Apply the hidden lens by filtering out columns that are mapped to an ontology attribute for which the hidden lens
    // is applied
    .filter(([, column]) => column.lensToApply !== LensIds.HIDDEN)
    .map(([name, column]) => ({
      name,
      udfs: getUdfsForLens(column.lensToApply as LensIds, column.dataType),
      clauses: column.sqlClauses,
      // The attribute referenced in sql clauses is the ontology attribute id (not qualified by namespace) for more
      // intuitive authoring of policies
      attribute: column.ontologyAttributeId,
    }));

/**
 * Rewrite the query for execution in athena
 * @param api api client
 * @param query the original query
 * @param referencedQueries queries that are referenced that should be substituted
 * @param dataSets data sets in the query
 * @param callingUser the user rewriting the query
 */
export const rewriteQuery = (
  api: ApiClient,
  query: string,
  referencedQueries: SavedQuery[],
  dataSets: GovernedDataSets,
  callingUser: CallingUser,
): Promise<Query> => {
  const queryRewriteInput: QueryRewriteInput = {
    query,
    dataProducts: Object.fromEntries(
      dataSets.map((dataSet) => [
        dataSet.addressedAs,
        {
          // Quotes ensure the qualified table name can be used directly in a query if the table name contains dashes or
          // other special characters
          tableName: `"${dataSet.dataSet.identifiers.catalog}"."${dataSet.dataSet.identifiers.database}"."${dataSet.dataSet.identifiers.table}"`,
          columns: buildColumnsForDataSet(dataSet.dataSet.columnMetadata),
        },
      ]),
    ),
    querySubstitutions: Object.fromEntries(
      referencedQueries.map((referencedQuery) => [
        toQueryAddressedAs(referencedQuery, callingUser),
        {
          query: referencedQuery.query,
        },
      ]),
    ),
  };
  console.log('Query rewrite input', JSON.stringify(queryRewriteInput));

  return api.postQueryParseRenderRewrite({
    queryRewriteInput,
  });
};

/**
 * Returns the lenses to apply for each of the given ontology attributes based on the attribute policies. Where a user
 * is in groups that match multiple differing policies, the least restrictive lens applies.
 * If no policy is found for the attribute id, it will not be included in the result.
 * @param api api client
 * @param namespaceAndAttributeIds the ontology attributes to retrieve lenses for
 * @param callingUser calling user details
 */
const getLensesToApplyFromAttributePolicies = async (
  api: ApiClient,
  namespaceAndAttributeIds: string[],
  callingUser: CallingUser,
): Promise<{ [namespaceAndAttributeId: string]: LensIds }> => {
  if (namespaceAndAttributeIds.length === 0) {
    return {};
  }

  const policies = await Promise.all(
    callingUser.groups.map(async (group) =>
      api.getGovernancePolicyAttributes({
        namespaceAndAttributeIds,
        group,
      }),
    ),
  );

  const leastRestrictivePolicies: { [namespaceAndAttributeId: string]: LensIds } = {};

  for (const policy of policies) {
    for (const [namespaceAndAttributeId, lensId] of Object.entries(policy.attributeIdToLensId)) {
      leastRestrictivePolicies[namespaceAndAttributeId] = leastRestrictivePolicies[namespaceAndAttributeId]
        ? getLeastRestrictiveLens(lensId as LensIds, leastRestrictivePolicies[namespaceAndAttributeId])
        : (lensId as LensIds);
    }
  }

  return leastRestrictivePolicies;
};

/**
 * Get the default lens policies (if any) for the given data products
 * @param api api client
 * @param dataProductsInQuery the data products in the query
 */
const getDefaultLensPolicies = async (
  api: ApiClient,
  dataProductsInQuery: DataProductIdentifier[],
): Promise<{ [dataProductCompositeId: string]: DefaultLensPolicy }> => {
  const policies = await Promise.all(
    dataProductsInQuery.map(({ domainId, dataProductId }) =>
      getDefaultLensPolicyIfExists(api, domainId, dataProductId),
    ),
  );
  return Object.fromEntries(
    (policies.filter((policy) => policy) as DefaultLensPolicy[]).map((policy) => [
      `${policy.domainId}.${policy.dataProductId}`,
      policy,
    ]),
  );
};

type AttributeIdToSqlClauses = { [namespaceAndAttributeId: string]: string[] };

/**
 * Returns the SQL where clauses to apply to the query for row level governance, for the given attribute ids and user's
 * groups. Where a user is in multiple groups and matches differing policies, clauses from all matching policies are
 * returned.
 * If no policy is found for the attribute id, it will not be included in the result.
 * @param api api client
 * @param namespaceAndAttributeIds the ontology attributes to retrieve clauses for
 * @param callingUser calling user details
 */
const getSqlClausesToApplyFromAttributeValuePolicies = async (
  api: ApiClient,
  namespaceAndAttributeIds: string[],
  callingUser: CallingUser,
): Promise<AttributeIdToSqlClauses> => {
  if (namespaceAndAttributeIds.length === 0) {
    return {};
  }

  const policies = await Promise.all(
    callingUser.groups.map((group) =>
      api.getGovernancePolicyAttributeValues({
        namespaceAndAttributeIds,
        group,
      }),
    ),
  );

  const allMatchingPolicies: AttributeIdToSqlClauses = {};

  for (const policy of policies) {
    for (const [namespaceAndAttributeId, sqlClause] of Object.entries(
      policy.attributeIdToSqlClause as { [namespaceAndAttributeId: string]: string },
    )) {
      allMatchingPolicies[namespaceAndAttributeId] = (allMatchingPolicies[namespaceAndAttributeId] || []).concat([
        sqlClause,
      ]);
    }
  }

  return allMatchingPolicies;
};

/**
 * Get all ontologies
 * @param api api client
 * @param namespaceAndAttributeIds uniquely identify the ontologies
 * @returns
 */
const getOntologies = async (
  api: ApiClient,
  namespaceAndAttributeIds: string[],
): Promise<{ [namespaceAndAttributeId: string]: OntologyEntity }> => {
  if (namespaceAndAttributeIds.length === 0) {
    return {};
  }

  const ontologies = await Promise.all(
    namespaceAndAttributeIds.map((id) => buildUniqOntology(id)).map((id) => api.getOntology(id)),
  );
  console.log('inside get ontologies: ' + JSON.stringify(ontologies));

  return Object.fromEntries(
    ontologies.map((o) => [[buildNamespaceAndAttributeId(o.ontologyNamespace, o.ontologyId)], o]),
  );
};

/**
 * Select the lens to apply for a given column based on the applicable policies
 * @param dataSet the data set in which the column resides
 * @param column the column to select the lens for
 * @param attributePolicies policies governing ontology attributes
 * @param defaultLensPolicies default policies for columns
 * @param userGroups the groups a user is part of
 */
const selectLensToApply = (
  dataSet: QueriedDataSet,
  column: ColumnMetadata,
  attributePolicies: { [namespaceAndAttributeId: string]: LensIds },
  defaultLensPolicies: { [dataProductCompositeId: string]: DefaultLensPolicy },
  userGroups: Set<string>,
  ontologies: { [namespaceAndAttributeId: string]: OntologyEntity },
): LensIds => {
  // Attribute policy has precedence if one applies
  const ontologyWithNamespace = buildNamespaceAndAttributeId(column.ontologyNamespace!, column.ontologyAttributeId!);
  if (ontologyWithNamespace in attributePolicies) {
    return attributePolicies[ontologyWithNamespace];
  }

  // Apply default lens of the ontology
  if (ontologyWithNamespace in ontologies) {
    return ontologies[ontologyWithNamespace].defaultLens as LensIds;
  }

  // Default policy is applied next
  const defaultLensPolicy = defaultLensPolicies[`${dataSet.domainId}.${dataSet.dataProductId}`];
  if (defaultLensPolicy) {
    // Find the lens overrides that apply for the user's groups
    const overrideLenses = Object.entries(defaultLensPolicy.defaultLensOverrides)
      .filter(([group]) => userGroups.has(group))
      .map(([, lens]) => lens as LensIds);
    if (overrideLenses.length > 0) {
      // There is at least one matching lens override, so we choose the least restrictive
      return _.minBy(overrideLenses, getLensRestrictiveness)!;
    }
    // No overrides, so the default applies
    return defaultLensPolicy.defaultLensId as LensIds;
  }

  // No attribute policy or default lens policy applies, so the user can view the column in the clear
  return LensIds.CLEAR;
};

/**
 * Applies governance to data sets
 * @param api api client
 * @param dataProductsInQuery the unique data products involved in the query
 * @param dataSets all data sets involved in the query
 * @param callingUser the user performing the query
 */
export const applyGovernanceToDataSets = async (
  api: ApiClient,
  dataProductsInQuery: DataProductIdentifier[],
  dataSets: QueriedDataSet[],
  callingUser: CallingUser,
): Promise<GovernedDataSets> => {
  // Get the ontology attribute ids for which to look up policies
  const ontologyAttributes = getUniqueOntologyAttributeIds(dataSets);
  console.log('ontologyAttributes ', ontologyAttributes);

  // Retrieve attribute policies and default lens policies in parallel
  const [lensesToApply, defaultLensPolicies, sqlClausesToApply, ontologies] = await Promise.all([
    getLensesToApplyFromAttributePolicies(api, ontologyAttributes, callingUser),
    getDefaultLensPolicies(api, dataProductsInQuery),
    getSqlClausesToApplyFromAttributeValuePolicies(api, ontologyAttributes, callingUser),
    getOntologies(api, ontologyAttributes),
  ]);

  const userGroups = new Set(callingUser.groups);

  // Return the governed data sets
  return dataSets.map((dataSet) => ({
    ...dataSet,
    dataSet: {
      ...dataSet.dataSet,
      columnMetadata: Object.fromEntries(
        Object.entries(dataSet.dataSet.columnMetadata).map(([name, column]) => [
          name,
          {
            ...column,
            lensToApply: selectLensToApply(dataSet, column, lensesToApply, defaultLensPolicies, userGroups, ontologies),
            sqlClauses:
              column.ontologyNamespace && column.ontologyAttributeId
                ? sqlClausesToApply[
                    buildNamespaceAndAttributeId(column.ontologyNamespace, column.ontologyAttributeId)
                  ] || []
                : [],
          },
        ]),
      ),
    },
  }));
};

const identifyQueryReference = ({
  identifierParts,
}: PostQueryParseRenderDiscoverResponseTables): QueryReference | Error => {
  if (identifierParts.length < 2) {
    return new Error(
      `Must specify domain to query a data product, received un-qualified name: ${identifierParts.join('.')}`,
    );
  }
  if (identifierParts.length > 4) {
    return new Error(`Too many parts specified in ${identifierParts.join('.')}`);
  }

  if (identifierParts[0] === ReservedDomains.SOURCE) {
    return {
      type: QueryReferenceType.SOURCE_DATA_SET,
      identifierParts: identifierParts.slice(1),
    };
  }

  // Only queries with the source prefix can have 4 parts, otherwise should be 2 or 3.
  if (identifierParts.length === 4) {
    return new Error(`Too many parts specified in ${identifierParts.join('.')}`);
  }

  // Eg. domain.queries.queryname
  if (identifierParts[1] === ReservedDataProducts.QUERIES) {
    return {
      type: QueryReferenceType.QUERY,
      identifierParts,
    };
  }

  return {
    type: QueryReferenceType.DATA_SET,
    identifierParts,
  };
};

const identifyQueryReferences = (referencesInQuery: PostQueryParseRenderDiscoverResponseTables[]): QueryReference[] => {
  const queryReferences = referencesInQuery.map(identifyQueryReference);
  const invalidQueryReferences = queryReferences.filter((result) => result instanceof Error) as Error[];

  if (invalidQueryReferences.length > 0) {
    throw new Error(invalidQueryReferences.map((e) => e.message).join(', '));
  }
  return queryReferences as QueryReference[];
};

export interface ReferencedQueriesAndDataProducts {
  readonly dataProductIdentifiers: DataProductIdentifier[];
  readonly dataProducts: DataProduct[];
  readonly dataSets: QueriedDataSet[];
  readonly queries: SavedQuery[];
}

/**
 * Given a query, retrieve all directly or recursively referenced queries and data sets
 * @param api api client
 * @param query the query to retrieve info for
 * @param callingUser calling user details
 */
export const getReferencedQueriesAndDataSets = async (
  api: ApiClient,
  query: string,
  callingUser: CallingUser,
): Promise<ReferencedQueriesAndDataProducts> => {
  console.log('Retrieving references in query', query);
  const referencesInQuery = identifyQueryReferences((await discoverQuery(api, callingUser.userId, query)).tables);

  console.log('References found in query', JSON.stringify(referencesInQuery));
  // Split into the data sets and queries referenced
  const dataSetReferences = referencesInQuery.filter(
    ({ type }) => type === QueryReferenceType.DATA_SET || type === QueryReferenceType.SOURCE_DATA_SET,
  );
  const queryReferences = referencesInQuery.filter(({ type }) => type === QueryReferenceType.QUERY);

  // First, get any queries referenced directly in the query
  const directlyReferencedQueryIdentifiers = getUniqueSavedQueryIdentifiers(queryReferences, callingUser);
  console.log('Fetching directly referenced queries', JSON.stringify(directlyReferencedQueryIdentifiers));
  const directlyReferencedQueries = await getSavedQueries(api, directlyReferencedQueryIdentifiers);

  // Collate the directly and recursively referenced data sets
  const allDataSetReferences: QueryReference[] = dataSetReferences.concat(
    directlyReferencedQueries.flatMap((savedQuery) =>
      savedQuery.referencedDataSets.map(({ addressedAs }) => {
        const reference = identifyQueryReference(unpackAddressedAs(addressedAs));
        if (reference instanceof Error) {
          console.error(
            `A saved query was created previously with an invalid reference ${addressedAs}, this should not happen!`,
          );
          throw reference;
        }
        return reference;
      }),
    ),
  );
  console.log('All data set references', JSON.stringify(allDataSetReferences));

  // Get the unique data product identifiers to fetch
  const dataProductIdentifiers = getUniqueDataProductIdentifiers(allDataSetReferences);
  console.log('Unique data products in query', JSON.stringify(dataProductIdentifiers));

  // Retrieve the recursively referenced query identifiers
  const recursivelyReferencedQueryIdentifiers: SavedQueryIdentifier[] = _.uniqWith(
    directlyReferencedQueries.flatMap((savedQuery) => savedQuery.referencedQueries),
    _.isEqual,
  );
  console.log('Recursively referenced queries', JSON.stringify(recursivelyReferencedQueryIdentifiers));

  // Fetch the saved queries we haven't already fetched
  const directlyReferencedCompactQueryIds = new Set(
    directlyReferencedQueryIdentifiers.map(({ namespace, queryId }) => `${namespace}.${queryId}`),
  );
  const missingQueryIdentifiers = recursivelyReferencedQueryIdentifiers.filter(
    ({ namespace, queryId }) => !directlyReferencedCompactQueryIds.has(`${namespace}.${queryId}`),
  );

  console.log('Missing queries', JSON.stringify(missingQueryIdentifiers));
  const [dataProducts, recursivelyReferencedQueries] = await Promise.all([
    getDataProductsInQuery(api, dataProductIdentifiers),
    getSavedQueries(api, missingQueryIdentifiers),
  ]);

  // We return all queries referenced directly or recursively
  const queries = directlyReferencedQueries.concat(recursivelyReferencedQueries);
  console.log('Queries in query', JSON.stringify(queries));

  // Get the data sets involved in the query
  const dataProductsById = Object.fromEntries(
    dataProducts.map((dataProduct) => [`${dataProduct.domainId}.${dataProduct.dataProductId}`, dataProduct]),
  );
  console.log('Data products in query by id: ', dataProductsById);

  // Only the owner of a data product is allowed to query its source
  const sourceDataSetsNotOwnedByCaller = allDataSetReferences.filter(
    ({ type, identifierParts: [domainId, dataProductId] }) =>
      type === QueryReferenceType.SOURCE_DATA_SET &&
      dataProductsById[`${domainId}.${dataProductId}`].createdBy !== callingUser.userId,
  );
  if (sourceDataSetsNotOwnedByCaller.length > 0) {
    throw new Error(`You must be the owner to query ${sourceDataSetsNotOwnedByCaller.map(toAddressedAs).join(', ')}`);
  }

  const dataSets = getDataSetsInQuery(allDataSetReferences, dataProductsById);

  return {
    dataProductIdentifiers,
    dataProducts,
    dataSets,
    queries,
  };
};

/**
 * Run a query discovery to get the insights of the input provided by the user
 * it will return the item in cache if the query has been performed before
 * @param api an instance of the ApiClient to be used to perform the query
 * @param userId the userId that is performing the action
 * @param query the query to discover
 * @returns the discovery response
 */
export const discoverQuery = async (
  api: ApiClient,
  userId: string,
  query: string,
): Promise<PostQueryParseRenderDiscoverResponse> => {
  const cacheId = computeUniqueHash(query);
  const cachedQuery = await CachedQueryStore.getInstance().getCachedDiscoveryQuery(cacheId);

  if (!cachedQuery) {
    console.log(`cachedQuery ${cachedQuery}`);
    const discoverResponse = await api.postQueryParseRenderDiscover({ query: { query } });
    await CachedQueryStore.getInstance().putCachedDiscoveryQuery(cacheId, userId, {
      cacheId,
      query,
      discoverResponse,
    });

    return discoverResponse;
  }

  return cachedQuery.discoverResponse;
};

/**
 * Retrieve the last data product data update date
 * @param callingUser the user that is performing the action
 * @param originalQuery the original Ada query
 * @returns date in ISO format
 */
export const getLastUpdatedDataProductDate = async (callingUser: CallingUser, originalQuery: string) => {
  const api = ApiClient.create(callingUser);
  const { dataProducts } = await getReferencedQueriesAndDataSets(api, originalQuery, callingUser);
  const dates = dataProducts
    .filter((q) => !!q.latestDataUpdateTimestamp)
    .map((q) => new Date(q.latestDataUpdateTimestamp!).getTime());

  return dates.length > 0 ? new Date(Math.max.apply(null, dates)).toISOString() : undefined;
};
