/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DiscoverTransformsOutput } from './prepare-transform-chain';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';
import { resolveTransforms } from '../../../components/transforms/utils/transform-utils';

/**
 * Prepare for the next transform to execute in the transform chain
 * @param event step function input
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<DiscoverTransformsOutput>,
  _context: any,
): Promise<DiscoverTransformsOutput> => {
  const { transformJobIndex, transformJobs, tableDetails } = event.Payload;

  const nextIndex = transformJobIndex + 1;
  const nextTransform = transformJobs[nextIndex];
  
  return {
    ...event.Payload,
    transformJobIndex: nextIndex,
    currentTransformJob: nextTransform,
    currentResolvedTransformJobs: resolveTransforms(tableDetails, nextTransform),
    tablePrefix: nextTransform?.outputCrawlerTablePrefix,
  };
};
