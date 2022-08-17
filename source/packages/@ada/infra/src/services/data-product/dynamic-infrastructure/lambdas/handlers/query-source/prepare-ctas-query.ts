/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance } from '@ada/aws-sdk';
import { DATA_PRODUCT_APPEND_DATA_PARTITION_KEY, DataSetIds, SourceDetailsQuery } from '@ada/common';
import { DataProduct, Query } from '@ada/api';
import { GlueDataProduct } from '../../../../core/glue/data.product';
import { StepFunctionLambdaEvent, buildCtasQuery, buildDropTableQuery, s3PathJoin } from '@ada/microservice-common';
import { VError } from 'verror';

export interface PrepareCtasQueryInput {
  crawlerName: string;
  dataProduct: DataProduct;
  tablePrefix: string;
  selectQuery: string;
  outputS3Path: string;
  database: string;
}

export interface PrepareCtasQueryOutput extends PrepareCtasQueryInput {
  ctasQuery: string;
  ctasTableName: string;
  dropTableQueries: Query[];
}

const glue = AwsGlueInstance();

/**
 * Lambda handler for preparing the ctas query used for creating data products from a query.
 */
export const handler = async (
  event: StepFunctionLambdaEvent<PrepareCtasQueryInput>,
  _context: any,
): Promise<PrepareCtasQueryOutput> => {
  const {
    crawlerName,
    dataProduct,
    tablePrefix: inputTablePrefix,
    selectQuery,
    outputS3Path: outputS3PathPrefix,
    database,
  } = event.Payload;

  const sourceDetails = dataProduct.sourceDetails as SourceDetailsQuery;

  // The CTAS query will create a table for the current timestamp
  const now = Date.now();
  let tablePrefix = `${inputTablePrefix}${now}`;

  // CTAS table name must not match the table prefix so that get-crawled-table-details does not discover them - these
  // are ephemeral tables which we create in order to write the underlying data to the correct s3 location.
  const tableName = `ctas-${tablePrefix}`;

  // We will drop the CTAS query at the end of the workflow
  const dropCtasTableQuery = buildDropTableQuery({ database, tableName });
  const dropTableQueries: Query[] = [{ query: dropCtasTableQuery }];

  let outputS3Path;

  if (sourceDetails.updateType === 'REPLACE') {
    // Write to a folder for the timestamp, not treated as a partition
    outputS3Path = s3PathJoin(outputS3PathPrefix, `${now}`, DataSetIds.DEFAULT);

    // Update the crawler to look at only this new s3 path, so it will discover only the data from the latest query run.
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

    // Find any previously created tables for this data product - if one exists it's the one we're replacing since we're
    // in REPLACE mode.
    const existingTables = await GlueDataProduct.getInstance(database).getTablesStartingWith(inputTablePrefix);
    dropTableQueries.push(
      ...existingTables.map((table) => ({ query: buildDropTableQuery({ database, tableName: table.Name }) })),
    );
  } else if (sourceDetails.updateType === 'APPEND') {
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
    throw new VError({ name: 'UnsupportedUpdateTypeError' }, `Unsupported update type ${sourceDetails.updateType}`);
  }

  // Build the CTAS query
  const ctasQuery = buildCtasQuery({
    database,
    tableName,
    selectQuery,
    outputS3Path,
    format: 'PARQUET',
  });

  return {
    ...event.Payload,
    ctasQuery,
    tablePrefix,
    ctasTableName: tableName,
    dropTableQueries,
  };
};
