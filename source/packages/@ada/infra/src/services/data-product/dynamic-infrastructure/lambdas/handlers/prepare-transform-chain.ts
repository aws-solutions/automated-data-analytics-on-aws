/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance } from '@ada/aws-sdk';
import { DataProduct } from '@ada/api';
import { DataProductUpdatePolicy } from '@ada/common';
import { GetGlueCrawledTableResult } from './get-crawled-table-details';
import { ResolvedTransformJob, StepFunctionLambdaEvent, TransformJob } from '@ada/microservice-common';
import { getApplicableTransforms, resolveTransforms } from '../../../components/transforms/utils/transform-utils';
import { getNewIngestionLocation } from './common';

export interface DiscoverTransformsInput extends GetGlueCrawledTableResult {
  transformJobs: TransformJob[];
  dataProduct: Pick<DataProduct, 'updateTrigger'>;
  ingestionTimestamp: string;
}

export interface DiscoverTransformsOutput extends DiscoverTransformsInput {
  transformJobIndex: number;
  transformJobCount: number;
  currentTransformJob?: TransformJob;
  currentResolvedTransformJobs?: ResolvedTransformJob[];
}

const glue = AwsGlueInstance();

/**
 * Discover the transforms to apply to the data product
 * @param event step function input
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<DiscoverTransformsInput>,
  _context: unknown,
): Promise<DiscoverTransformsOutput> => {
  const { tableDetails, transformJobs, ingestionTimestamp, dataProduct } = event.Payload;
  const { updatePolicy } = dataProduct.updateTrigger;

  // Filter out any transforms that are not applicable based on the data classification
  let orderedTransforms = getApplicableTransforms(transformJobs, tableDetails);

  // update transform to the new glue table and output location if the data product has UpdatePolicy.REPLACE
  // no need to update then UpdatePolicy is APPEND as it will use the same glue table and same output location
  // but with jobbookmark enable on the transform job to handle the incremental updates
  if (updatePolicy === undefined || updatePolicy === DataProductUpdatePolicy.REPLACE) {
    // remap the transform to have time-segregated paths
    // this code matches the REPLACE case in external-import/prepare-external-import.ts
    orderedTransforms = orderedTransforms.map((transform) => {
      const { tablePrefix, outputS3Path } = getNewIngestionLocation(
        transform.outputCrawlerTablePrefix,
        transform.outputS3TargetPath,
        ingestionTimestamp,
      );
      return {
        ...transform,
        outputS3TargetPath: outputS3Path,
        outputCrawlerTablePrefix: tablePrefix,
      };
    });

    // update the glue crawler to look in time-segregated path instead of the entire transform directory
    for (const transform of orderedTransforms) {
      const { outputCrawlerName, outputS3TargetPath, outputCrawlerTablePrefix } = transform;
      await glue
        .updateCrawler({
          Name: outputCrawlerName,
          Targets: {
            S3Targets: [
              {
                Path: outputS3TargetPath.replace('s3://', ''),
              },
            ],
          },
          TablePrefix: outputCrawlerTablePrefix,
        })
        .promise();
    }
  }

  const currentTransformJob = orderedTransforms[0];

  return {
    ...event.Payload,
    transformJobs: orderedTransforms,
    transformJobIndex: 0,
    transformJobCount: orderedTransforms.length,
    currentTransformJob,
    currentResolvedTransformJobs: resolveTransforms(tableDetails, currentTransformJob),
  };
};
