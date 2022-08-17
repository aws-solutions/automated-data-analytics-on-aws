/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { DataProductPreview, DataProductPreviewInput } from '@ada/api';
import { StepFunctionExecutionStatus, sleep } from '@ada/common';
import { api } from './client';
import { pick } from 'lodash';
import type {
  CreateAndUpdateDetails,
  DataProduct,
} from '@ada/api';

export type DataProductWithCreateAndUpdateDetails = DataProduct & CreateAndUpdateDetails;

/**
 * Preview a data product until complete
 */
export const previewDataProductUntilComplete = async (
  dataProduct: DataProduct,
  auto: boolean,
): Promise<DataProductPreview> => {
  const { domainId, dataProductId } = dataProduct;
  const input = pick(dataProduct, [
    'domainId',
    'dataProductId',
    'name',
    'sourceType',
    'sourceDetails',
    'updateTrigger',
    'transforms',
  ] as (keyof DataProductPreviewInput)[]);
  try {
    const { previewId } = await api.postDataProductPreviewDomainDataProduct({
      domainId,
      dataProductId,
      dataProductPreviewInput: {
        ...input,
        ...(auto
          ? {
              // Enable automatic transforms for the preview to infer transforms from source data
              enableAutomaticTransforms: true,
              // We always run with no transforms for the schema preview, this handles the case where a user navigates
              // back to this screen after adding other transforms!
              transforms: [],
            }
          : {
              // Disable automatic transform so we use from transform planner
              enableAutomaticTransforms: false,
            }),
      },
    });

    let status: StepFunctionExecutionStatus = StepFunctionExecutionStatus.RUNNING;
    let result: DataProductPreview;

    do {
      await sleep(POLLING.DATA_PRODUCT_PREVIEW);
      result = await api.getDataProductPreviewDomainDataProduct({
        domainId,
        dataProductId,
        previewId,
      });
      status = result.status as StepFunctionExecutionStatus;
    } while (status === StepFunctionExecutionStatus.RUNNING);

    return result;
  } catch (e: any) {
    return {
      previewId: 'unavailable',
      status: StepFunctionExecutionStatus.FAILED,
      error: 'json' in e ? await e.json() : e,
    };
  }
};
