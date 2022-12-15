/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance } from '@ada/aws-sdk';
import { DataProduct } from '@ada/api';
import { DataProductUpdatePolicy } from '@ada/common';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';
import { VError } from 'verror';
import { getNewIngestionLocation, getNewIngestionPartition } from '../common';
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
  ingestionTimestamp: string;
  scheduleRate?: string;
}

const glue = AwsGlueInstance();

/**
 * Lambda handler for preparing the ctas query used for creating data products from external source.
 */
export const handler = async (
  event: StepFunctionLambdaEvent<PrepareExternalImportInput>,
  _context: unknown,
): Promise<PrepareExternalImportOutput> => {
  const { crawlerName, dataProduct, tablePrefix: inputTablePrefix, outputS3Path: outputS3PathPrefix } = event.Payload;
  let outputS3Path, tablePrefix;
  const { triggerType, updatePolicy, scheduleRate } = dataProduct.updateTrigger;
  const ingestionTimestamp = Date.now().toString();

  // if update policy is APPEND, for every update, the new data will be imported in the same location as a new partition by the ingestion timestamp
  // and always use the same glue table.
  //    for example:
  // .           - outputLocation: outputS3PathPrefix/ada_default_dataset/1670629770233
  //             - tableName: tableprefix
  // .  the transform chain should run on the
  //
  // if update policy is REPLACE, for every upate, the new data will be imported to a new location and use a new glue table
  // .  for example:
  //             - outputLocation: outputS3PathPrefix/1670629770233/ada_default_dataset/
  // .           - tableName: tableprefix1670629770233
  // This logic should apply to all connectors so every connection must have PrepareExternalImport as the first step in the
  // importing state machine

  if (updatePolicy === DataProductUpdatePolicy.APPEND) {
    // Use the glue partition syntax to treat new data as another partition of the existing table
    // The table prefix for our crawler remains unchanged since we're updating the existing table. We therefore return
    // the original table prefix for the get-crawled-table-details step which comes later.
    const newIngestionLocation = getNewIngestionPartition(inputTablePrefix, outputS3PathPrefix, ingestionTimestamp);
    tablePrefix = newIngestionLocation.tablePrefix;
    outputS3Path = newIngestionLocation.outputS3Path;
  }
  // if update policy is undefined, it is default to be REPLACE. This should be changed to be more explicit later
  // keep it for backward compatibility
  else if (updatePolicy === undefined || updatePolicy === DataProductUpdatePolicy.REPLACE) {
    const newIngestionLocation = getNewIngestionLocation(inputTablePrefix, outputS3PathPrefix, ingestionTimestamp);
    tablePrefix = newIngestionLocation.tablePrefix;
    outputS3Path = newIngestionLocation.outputS3Path;
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
  } else {
    throw new VError(
      { name: 'UsupportedUpdatePolicyError' },
      `Unsupported update policy ${updatePolicy}. Valid value is APPEND or REPLACE`,
    );
  }

  return {
    ...event.Payload,
    tablePrefix,
    outputS3Path,
    triggerType,
    ingestionTimestamp,
    scheduleRate,
  };
};
