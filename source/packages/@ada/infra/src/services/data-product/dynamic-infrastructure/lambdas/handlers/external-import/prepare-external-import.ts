/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance } from '@ada/aws-sdk';
import {
  DATA_PRODUCT_APPEND_DATA_PARTITION_KEY,
  DataProductUpdatePolicy,
  DataProductUpdateTriggerType,
  DataSetIds,
} from '@ada/common';
import { DataProduct } from '@ada/api';
import { StepFunctionLambdaEvent, s3PathJoin } from '@ada/microservice-common';
import { VError } from 'verror';
export interface PrepareExternalImportInput {
  crawlerName: string;
  tablePrefix: string;
  outputS3Path: string;
  dataProduct: DataProduct;
}

export interface PrepareExternalImportOutput {
  crawlerName: string;
  tablePrefix: string;
  outputS3Path: string;
  triggerType: string;
  scheduleRate?: string;
}

const glue = AwsGlueInstance();

/**
 * Lambda handler for preparing the ctas query used for creating data products from external source.
 */
export const handler = async (
  event: StepFunctionLambdaEvent<PrepareExternalImportInput>,
  _context: any,
): Promise<PrepareExternalImportOutput> => {
  const { crawlerName, dataProduct, tablePrefix: inputTablePrefix, outputS3Path: outputS3PathPrefix } = event.Payload;
  let outputS3Path, tablePrefix;
  const { triggerType, updatePolicy, scheduleRate } = dataProduct.updateTrigger;
  const now = Date.now();

  if (updatePolicy === DataProductUpdatePolicy.APPEND) {
    if (dataProduct.updateTrigger.triggerType === DataProductUpdateTriggerType.SCHEDULE) {
      // Use the glue partition syntax to treat new data as another partition of the existing table
      outputS3Path = s3PathJoin(
        outputS3PathPrefix,
        DataSetIds.DEFAULT,
        `${DATA_PRODUCT_APPEND_DATA_PARTITION_KEY}=${now}`,
      );
      // The table prefix for our crawler remains unchanged since we're updating the existing table. We therefore return
      // the original table prefix for the get-crawled-table-details step which comes later.
      tablePrefix = inputTablePrefix;
    } else {
      // currently only supports scheduled append, on-demand support to be implemented
      throw new VError(
        { name: 'UsupportedUpdateTypeError' },
        `Unsupported update type ${updatePolicy} with trigger type ${dataProduct.updateTrigger?.triggerType}`,
      );
    }
  } else {
    tablePrefix = `${inputTablePrefix}${now}`;
    outputS3Path = s3PathJoin(outputS3PathPrefix, `${now}`, DataSetIds.DEFAULT);
    await glue
      .updateCrawler({
        Name: crawlerName,
        Targets: {
          S3Targets: [
            {
              Path: outputS3Path.replace('s3://', ''),
            },
          ],
        },
        TablePrefix: tablePrefix,
      })
      .promise();
  }
  return {
    ...event.Payload,
    tablePrefix,
    outputS3Path,
    triggerType,
    scheduleRate,
  };
};
