/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { CallingUser } from '@ada/common';
import { ColumnMetadata, ColumnsMetadata, DataProduct, DataSet, DataSets } from '@ada/api-client';
import { ILockClient } from '../../../../../api/components/entity/locks/client';
import { IRelationshipClient } from '../../../../../api/components/entity/relationships/client';
import { entityIdentifier } from '@ada/api-client/types';
import maxBy from 'lodash/maxBy';

// The minimum schema similarity score for schemas to be considered similar enough to match datasets
const SCHEMA_SIMILARITY_SCORE_THRESHOLD = 0.5;

type ColumnMetadataEntry = ColumnMetadata & { name: string };

export const columnMetadataToList = (columnMetadata: ColumnsMetadata): ColumnMetadataEntry[] => {
  return Object.entries(columnMetadata).map(([name, metadata]) => ({
    name,
    ...metadata,
  }));
};

/**
 * Return a score between 0 and 1 that represents how "similar" the given schemas are
 */
export const getSchemaSimilarityScore = (
  discoveredSchema: ColumnsMetadata,
  discoveredSchemaList: ColumnMetadataEntry[],
  currentSchema: ColumnsMetadata,
): number => {
  // Matches for both name and data type
  const fullyMatchingColumnsScore =
    discoveredSchemaList.filter(({ name, dataType }) => currentSchema[name]?.dataType === dataType).length /
    discoveredSchemaList.length;
  const nameMatchingColumnsScore =
    discoveredSchemaList.filter(({ name }) => currentSchema[name]).length / discoveredSchemaList.length;

  // Also consider non-matching columns, with a lower score for more missing columns
  const currentSchemaList = columnMetadataToList(currentSchema);
  const nonMatchingColumnsScore =
    1 - currentSchemaList.filter(({ name }) => !discoveredSchema[name]).length / currentSchemaList.length;

  // Weight fully matching columns as the most important factor
  return (2 * fullyMatchingColumnsScore + nameMatchingColumnsScore + nonMatchingColumnsScore) / 4;
};

/**
 * Find the best matching data set by the similarity of the schema (ie column names and types)
 */
const findBestMatchingCurrentDataSetBySchema = (dataSet: DataSet, currentDataSets: DataSets): DataSet | undefined => {
  const discoveredDataSetColumns = columnMetadataToList(dataSet.columnMetadata);

  const schemaSimilarityScores = Object.entries(currentDataSets).map(([dataSetId, currentDataSet]) => [
    dataSetId,
    getSchemaSimilarityScore(dataSet.columnMetadata, discoveredDataSetColumns, currentDataSet.columnMetadata),
  ]);

  const [bestScoringCurrentDataSetId, bestScore] = maxBy(schemaSimilarityScores, ([, score]) => score) || ['', 0];

  if (bestScore > SCHEMA_SIMILARITY_SCORE_THRESHOLD) {
    return currentDataSets[bestScoringCurrentDataSetId];
  }

  return undefined;
};

/**
 * Find the current data set that best matches the given data set and its id.
 */
const findBestMatchingCurrentDataSet = (
  dataSetId: string,
  dataSet: DataSet,
  discoveredDataSets: DataSets,
  currentDataSets: DataSets,
): DataSet | undefined => {
  // When the dataset ids match, we've found the matching current dataset
  if (dataSetId in currentDataSets) {
    return currentDataSets[dataSetId];
  }

  // If there's only one existing data set and discovered data set, it's a match
  const discoveredDataSetIds = Object.keys(discoveredDataSets);
  const currentDataSetIds = Object.keys(currentDataSets);
  if (currentDataSetIds.length === 1 && discoveredDataSetIds.length === 1) {
    return currentDataSets[currentDataSetIds[0]];
  }

  return findBestMatchingCurrentDataSetBySchema(dataSet, currentDataSets);
};

/**
 * Combine the discovered data set with the best matching existing data set.
 * Here we want to ensure that the user's description or ontology attribute assignment is preserved for matching
 * columns.
 */
const reconcileDataSet = (dataSet: DataSet, bestMatchingCurrentDataSet?: DataSet): DataSet => {
  if (bestMatchingCurrentDataSet) {
    return {
      description: bestMatchingCurrentDataSet.description,
      name: bestMatchingCurrentDataSet.name,
      ...dataSet,
      columnMetadata: Object.fromEntries(
        Object.entries(dataSet.columnMetadata).map(([columnId, column]) => [
          columnId,
          {
            ...resolveColumn(bestMatchingCurrentDataSet.columnMetadata, column, columnId),
          },
        ]),
      ),
    };
  }
  return dataSet;
};

/**
 * Reconciles the existing data sets stored with a data product with the newly discovered data sets from the import
 * pipeline.
 * The newly discovered data sets are used as the source of truth, and supplemented with information already defined
 * in the data product where applicable.
 */
export const reconcileDataSets = (currentDataSets: DataSets, discoveredDataSets: DataSets): DataSets =>
  Object.fromEntries(
    Object.entries(discoveredDataSets).map(([dataSetId, dataSet]) => [
      dataSetId,
      reconcileDataSet(
        dataSet,
        findBestMatchingCurrentDataSet(dataSetId, dataSet, discoveredDataSets, currentDataSets),
      ),
    ]),
  );

/**
 * Relates the data product's mapped ontologies to the data product. This will update all relationships to be consistent
 * with the current state of the data product, so will also remove relationships to unmapped ontologies.
 * @param callingUser the user updating the relationships
 * @param api api client
 * @param dataProduct the data product to relate to its mapped ontologies
 * @param lockClient client for locking entities
 * @param relationshipClient client for updating relationships
 */
export const relateDataProductWithOntologies = async (
  callingUser: CallingUser,
  api: ApiClient,
  dataProduct: DataProduct,
  lockClient: ILockClient,
  relationshipClient: IRelationshipClient,
) => {
  const { domainId, dataProductId, dataSets } = dataProduct;
  const dataProductEntity = entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId });

  // Get all the ontologies related to all datasets
  const ontologyEntities = Object.values(dataSets).flatMap(({ columnMetadata }) =>
    Object.values(columnMetadata).flatMap(({ ontologyNamespace, ontologyAttributeId }) =>
      ontologyNamespace && ontologyAttributeId
        ? [
            entityIdentifier('Ontology', {
              ontologyId: ontologyAttributeId,
              ontologyNamespace,
            }),
          ]
        : [],
    ),
  );

  // Find the difference in relationships to those we have stored
  const { childrenToAdd, childrenToRemove } = await relationshipClient.diffRelationships(
    dataProductEntity,
    ontologyEntities,
  );

  // Optimistically lock any new ontologies we will add relationships to
  const lockedOntologies = await lockClient.acquire(...childrenToAdd);

  // Check that all the newly added ontologies exist
  await Promise.all(
    childrenToAdd.map(({ identifierParts: [ontologyNamespace, ontologyId] }) =>
      api.getOntology({
        ontologyNamespace,
        ontologyId,
      }),
    ),
  );

  // Update the relationships
  await Promise.all([
    relationshipClient.addRelationships(callingUser, dataProductEntity, childrenToAdd),
    relationshipClient.removeRelationships(dataProductEntity, childrenToRemove),
  ]);

  // Release the ontology locks
  await lockClient.release(...lockedOntologies);
};

/**
 * Resolve an existing column with a new column triggered by a data product update
 * @param existingColumns the column metadata that already exists in the data product
 * @param newColumn new details for the column
 * @returns
 */
export function resolveColumn(existingColumns: ColumnsMetadata, newColumn: ColumnMetadata, newColumnName: string) {
  // get column key
  const name = existingColumns[newColumnName]
    ? newColumnName
    : Object.keys(existingColumns).find((columnName) => columnName.toLowerCase() === newColumnName.toLowerCase());

  if (name) {
    // resolve pii classification
    const existingPii = existingColumns[name].piiClassification ? existingColumns[name].piiClassification : undefined;
    const newPii = newColumn.piiClassification ? newColumn.piiClassification : undefined;
    // prioritise a pii that already exists over the newly detected pii
    const piiClassification = existingPii || newPii || undefined;

    // resolve ontologyId
    const existingOntology = existingColumns[name].ontologyAttributeId || undefined;
    const ontologyAttributeId = existingOntology || newColumn.ontologyAttributeId || piiClassification;
    // resolve ontology namespace
    const existingNamespace = existingColumns[name].ontologyNamespace || undefined;
    const ontologyNamespace = existingNamespace || newColumn.ontologyNamespace || undefined;

    const description = newColumn.description || existingColumns[name].description || undefined;
    return {
      ...newColumn,
      piiClassification,
      ontologyAttributeId,
      ontologyNamespace,
      description,
    };
  }
  // name is undefined which indicates it is a new column
  return newColumn;
}
