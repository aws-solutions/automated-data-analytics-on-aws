/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductPreviewInput } from '../../../api/handlers/post-data-product-preview';
import { DataProductTransform } from '@ada/api-client';
import { ScriptBucket } from '../../s3/script';
import { StepFunctionLambdaEvent, TableDescriptor, s3PathJoin, toS3Path } from '@ada/microservice-common';
import { getApplicableTransforms, getPossibleTransformsForDataProduct } from '../../transforms/utils/transform-utils';
import { v4 as uuid } from 'uuid';

export interface TableSample extends TableDescriptor {
  readonly sampleDataS3Path: string;
  readonly originalDataS3Path: string;
}

export interface DiscoverPreviewTransformsInput extends DataProductPreviewInput {
  readonly tableDetails: TableSample[];
}

export interface PreviewTransform extends DataProductTransform {
  readonly scriptContent: string;
  readonly tempS3Path: string;
}

export interface DiscoverPreviewTransformsOutput extends DiscoverPreviewTransformsInput {
  readonly orderedTransforms: PreviewTransform[];
}

/**
 * Discover the transforms to apply to the data product
 * @param event step function input
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<DiscoverPreviewTransformsInput>,
  _context: any,
): Promise<DiscoverPreviewTransformsOutput> => {
  const { dataProduct, tableDetails } = event.Payload;

  const possibleTransforms = getPossibleTransformsForDataProduct(dataProduct);

  const scriptBucket = ScriptBucket.getInstance();

  // Filter out any transforms that are not applicable based on the data classification, and retrieve the script content
  // from s3
  const orderedTransforms = await Promise.all(
    getApplicableTransforms(possibleTransforms, tableDetails).map(async (transform, i) => {
      const { scriptId, namespace, inlineScriptContent, inputArgs } = transform;
      // Use inline script content if provided, otherwise assume the script is readily available in s3
      const scriptContent = inlineScriptContent || (await scriptBucket.getScript(transform)).scriptContent;
      return {
        scriptId,
        namespace,
        scriptContent,
        inputArgs,
        tempS3Path: toS3Path({
          bucket: process.env.TEMP_BUCKET_NAME!,
          key: s3PathJoin(dataProduct.domainId, dataProduct.dataProductId, uuid(), 'temp', `${i}`, scriptId),
        }),
      };
    }),
  );

  return {
    ...event.Payload,
    orderedTransforms,
  };
};
