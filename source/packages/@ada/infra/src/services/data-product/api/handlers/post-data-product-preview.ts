/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsKMSInstance } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import { DataProduct } from '@ada/api-client';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';
import {
  extractExecutionIdFromExecutionArn,
  startStateMachineExecution,
} from '../../../query/components/step-functions';

// The default number of rows for a preview - keep this small for quick preview iteration
const DEFAULT_PREVIEW_SAMPLE_SIZE = 10;

const kms = AwsKMSInstance();
const DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN = process.env.DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN ?? '';

interface DataProductWithEncryptedSourceDetails
  extends Omit<DataProduct, 'sourceDetails' | 'name' | 'tags' | 'updateTrigger'> {
  sourceDetails: string;
}

export interface DataProductPreviewInput {
  readonly dataProduct: DataProductWithEncryptedSourceDetails;
  readonly sampleSize: number;
  readonly callingUser: CallingUser;
}

/**
 * Handler for starting a data product preview
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'postDataProductPreviewDomainDataProduct',
  async ({ requestParameters, body: dataProduct }, callingUser, _event, { log }) => {
    const { dataProductId, domainId, sampleSize: inputSampleSize } = requestParameters;
    const sampleSize = inputSampleSize ? Number(inputSampleSize) : DEFAULT_PREVIEW_SAMPLE_SIZE;

    const encrypt = await kms
      .encrypt({
        KeyId: process.env.KEY_ID!,
        Plaintext: JSON.stringify(dataProduct.sourceDetails || {}),
      })
      .promise();

    const input: StepFunctionLambdaEvent<DataProductPreviewInput> = {
      Payload: {
        dataProduct: {
          ...dataProduct,
          domainId,
          dataProductId,
          sourceDetails: encrypt.CiphertextBlob!.toString('base64'),
          childDataProducts: dataProduct.childDataProducts || [],
          parentDataProducts: dataProduct.parentDataProducts || [],
          dataSets: dataProduct.dataSets || {},
        },
        sampleSize,
        callingUser,
      },
    };
    log.info(`Starting execution with stateMachineArn ${DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN}`);
    const result = await startStateMachineExecution(DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN, input);

    return ApiResponse.success({
      previewId: extractExecutionIdFromExecutionArn(result.executionArn),
    });
  },
);
