/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GetGlueCrawledTableResult } from './get-crawled-table-details';
import { ResolvedTransformJob, StepFunctionLambdaEvent, TransformJob } from '@ada/microservice-common';
import { getApplicableTransforms, resolveTransforms } from '../../../components/transforms/utils/transform-utils';

export interface DiscoverTransformsInput extends GetGlueCrawledTableResult {
  transformJobs: TransformJob[];
}

export interface DiscoverTransformsOutput extends DiscoverTransformsInput {
  transformJobIndex: number;
  transformJobCount: number;
  currentTransformJob?: TransformJob;
  currentResolvedTransformJobs?: ResolvedTransformJob[];
}

/**
 * Discover the transforms to apply to the data product
 * @param event step function input
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<DiscoverTransformsInput>,
  _context: any,
): Promise<DiscoverTransformsOutput> => {
  const { tableDetails, transformJobs } = event.Payload;

  // Filter out any transforms that are not applicable based on the data classification
  const orderedTransforms = getApplicableTransforms(transformJobs, tableDetails);

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
