/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, isUserAllowed } from '@ada/api-gateway';
import { AwsS3Instance, AwsStepFunctionsInstance } from '@ada/aws-sdk';
import {
  ColumnMetadata,
  DataProductPreview,
  DataProductPreviewStatusEnum,
  DataSetPreview,
  DataSetPreviewSchema,
} from '@ada/api-client';
import { DataProductPreviewInput } from './post-data-product-preview';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { StepFunctionExecutionStatus } from '@ada/common';
import {
  StepFunctionLambdaEvent,
  buildErrorMessageFromStepFunctionErrorDetails,
  parseS3Path,
  previewSchemaToColumnMetadata,
} from '@ada/microservice-common';

import { getExecutionArnFromStateMachineArn } from '../../../query/components/step-functions';
const { DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN } = process.env;
const s3 = AwsS3Instance({ signatureVersion: 'v4' });

const sfn = AwsStepFunctionsInstance();
const logger = new Logger({ tags: ['getDataProductDomainDataProductPreview'] });

export interface DataSetPreviewList {
  [key: string]: DataSetPreview;
}

/**
 * Handler for getting a data product preview
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getDataProductPreviewDomainDataProduct',
  async ({ requestParameters }, callingUser, _event, { log }) => {
    const { previewId } = requestParameters;

    const stepFunctionExecution = await sfn
      .describeExecution({
        executionArn: `${getExecutionArnFromStateMachineArn(DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN ?? '', previewId)}`,
      })
      .promise();

    const input = JSON.parse(stepFunctionExecution.input!) as StepFunctionLambdaEvent<DataProductPreviewInput>;

    // Only the user that initiated the preview may request the results
    if (!isUserAllowed(callingUser, input.Payload.callingUser.userId, [])) {
      return ApiResponse.forbidden({
        message: `The user ${callingUser.userId} does not have the rights to perform this action`,
      });
    }

    const status = stepFunctionExecution.status as DataProductPreviewStatusEnum;

    const baseResponse: DataProductPreview = {
      previewId,
      status,
    };

    if (status === StepFunctionExecutionStatus.RUNNING) {
      return ApiResponse.success(baseResponse);
    }

    // Set the duration if possible
    if (stepFunctionExecution.stopDate) {
      baseResponse.durationMilliseconds =
        stepFunctionExecution.stopDate.getTime() - stepFunctionExecution.startDate.getTime();
    }
    log.info(`DataProductPreviewStatus: ${status}`);

    // Unexpected error state
    if (
      [
        StepFunctionExecutionStatus.ABORTED,
        StepFunctionExecutionStatus.TIMED_OUT,
        StepFunctionExecutionStatus.FAILED,
      ].includes(status as StepFunctionExecutionStatus)
    ) {
      return ApiResponse.success({
        ...baseResponse,
        error: {
          message: 'Preview execution failed, please try again',
        },
      } as DataProductPreview);
    }

    const output = JSON.parse(stepFunctionExecution.output!);

    // State machine completed with a known error
    if ('ErrorDetails' in output) {
      return ApiResponse.success({
        ...baseResponse,
        status: StepFunctionExecutionStatus.FAILED,
        error: {
          message: buildErrorMessageFromStepFunctionErrorDetails(output.ErrorDetails),
        },
      });
    }

    output.Payload.initialDataSets = await loadDataSets(output.Payload.initialDataSets);

    output.Payload.transformedDataSets = await loadDataSets(output.Payload.transformedDataSets);

    return ApiResponse.success({
      ...baseResponse,
      ...output.Payload,
    });
  },
);

/**
 * Load initial and transformed data from s3 due to step function payload limit of 256 KB (States.DataLimitExceeded)
 * https://aws.amazon.com/about-aws/whats-new/2020/09/aws-step-functions-increases-payload-size-to-256kb/
 * https://docs.aws.amazon.com/step-functions/latest/dg/limits-overview.html#service-limits-general
 */
const loadDataSets = async (datasets: DataSetPreviewList) => {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(datasets).map(async ([dataSetId, dataSet]) => [
        dataSetId,
        {
          ...dataSet,
          data: sanitiseDataForPreview((await loadJsonFromS3(dataSet.s3SamplePath)) || dataSet.data, dataSet.schema),
        },
      ]),
    ),
  );
};

// /**
//  * format the data based on schema definition
//  * @param data
//  * @param schema
//  * @returns [{key:value}]
//  */
const sanitiseDataForPreview = (data: any[], schema: DataSetPreviewSchema) => {
  const columnMetadata = previewSchemaToColumnMetadata(schema);
  return data.map((entry) =>
    Object.fromEntries(
      Object.entries(entry).map(([key, value]) => [
        key,
        key in columnMetadata ? formatValueAsType(value, columnMetadata[key]) : value,
      ]),
    ),
  );
};

const formatValueAsType = (value: any, columnMetadata: ColumnMetadata) => {
  try {
    switch (columnMetadata.dataType) {
      case 'date':
      case 'datetime':
        return new Date(value).toISOString();
      default:
        return value;
    }
  } catch (e: any) {
    logger.error('Error formatting value for data type: ', e);
    return value;
  }
};

/**
 * Load json objects from S3
 * @param s3Path
 * @returns
 */
const loadJsonFromS3 = async (s3Path?: string) => {
  if (s3Path) {
    const { bucket, key } = parseS3Path(s3Path);
    try {
      const data = await s3
        .getObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();
      return JSON.parse(data.Body!.toString('utf-8'));
    } catch (e: any) {
      logger.error('Error loading sample data from s3: ', e);
      return null;
    }
  }
};
