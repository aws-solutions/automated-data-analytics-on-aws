/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AUTOMATIC_TRANSFORMS, AutomaticTransform } from '@ada/transforms';
import { CrawledTableDetail, ResolvedTransformJob, TableDescriptor, TransformJob } from '@ada/microservice-common';
import { DataProduct, DataProductTransform, DataProductTransform as Transform } from '@ada/api-client';
import { VError } from 'verror';

/**
 * Builds the information required to run transforms in parallel for all given tables
 * @param tableDetails the tables to transform
 * @param nextTransform the next transform in the pipeline
 */
export const resolveTransforms = (
  tableDetails: CrawledTableDetail[],
  nextTransform?: TransformJob,
): ResolvedTransformJob[] =>
  nextTransform
    ? tableDetails.map((table) => ({
        ...nextTransform,
        inputTableName: table.tableName,
        outputS3TargetPath: `${nextTransform.outputS3TargetPath}${table.tableNameSuffix}/`,
        tempS3Path: `${nextTransform.tempS3Path}${table.tableNameSuffix}/`,
      }))
    : [];

/**
 * Find every script that may be involved in the transform chain.
 * These are all of the explicitly specified ones for the data product, plus ALL automatic transforms since the
 * specific automatic transforms to run are discovered at runtime
 * Note that the order of this array determines execution order. Automatic transforms are executed first.
 */

export const getPossibleTransformsForDataProduct = (
  dataProduct: Pick<DataProduct, 'enableAutomaticTransforms' | 'transforms' | 'sourceType'>,
): (DataProductTransform | AutomaticTransform)[] => {
  return (dataProduct.enableAutomaticTransforms ? (AUTOMATIC_TRANSFORMS as Transform[]) : []).concat(
    dataProduct.transforms,
  );
};

/**
 * Return the transforms that apply for the given input tables
 */
export const getApplicableTransforms = <T extends DataProductTransform | AutomaticTransform>(
  possibleTransforms: T[],
  tableDetails: TableDescriptor[],
): T[] => {
  const classifications = [...new Set(tableDetails.map((table) => table.classification))];

  if (classifications.length !== 1) {
    throw new VError(
      { name: 'MultipleDataFormatsDetectedError' },
      `A data product cannot have a mixture of data formats. Found: ${classifications.join(', ')}`,
    );
  }

  // Filter out any transforms that are not applicable based on the data classification
  return possibleTransforms.filter(
    (job) =>
      !('applicableClassifications' in job) ||
      job.applicableClassifications === undefined ||
      job.applicableClassifications.includes(classifications[0]),
  );
};
