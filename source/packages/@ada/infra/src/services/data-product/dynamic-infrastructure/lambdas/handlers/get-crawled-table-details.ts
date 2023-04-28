/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance } from '@ada/infra-common/aws-sdk';
import { CrawledTableDetail, StepFunctionLambdaEvent } from '@ada/microservice-common';
import { DATA_PRODUCT_APPEND_DATA_PARTITION_KEY } from '@ada/common';
import { Glue } from 'aws-sdk';
import { GlueDataProduct } from '../../../core/glue/data.product';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { VError } from 'verror';
import { pick } from 'lodash';

export interface GetGlueCrawledTableResult extends GetGlueCrawledTableEvent {
  tableDetails: CrawledTableDetail[];
}

export interface GetGlueCrawledTableEvent {
  readonly databaseName: string;
  readonly tablePrefix: string;
  readonly ingestionTimestamp?: string;
}

// list of all allowed TableInput keys
export const UPDATE_TABLE_KEYS: Array<keyof Glue.TableInput> = [
  'Description',
  'LastAccessTime',
  'LastAnalyzedTime',
  'Name',
  'Owner',
  'Parameters',
  'PartitionKeys',
  'Retention',
  'StorageDescriptor',
  'TableType',
  'TargetTable',
  'ViewExpandedText',
  'ViewOriginalText',
];

const EXTRANEOUS_PARTITION_KEY_PATTERN = /^partition_\d+$/;

/**
 * Get the information about the crawled table
 * @param event initial payload of step function execution
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GetGlueCrawledTableEvent>,
  context: any,
): Promise<GetGlueCrawledTableResult> => {
  const log = Logger.getLogger({
    lambda: {
      event,
      context,
    },
  });

  const { databaseName, tablePrefix, ingestionTimestamp } = event.Payload;
  const glue = AwsGlueInstance();

  const glueDataProduct = GlueDataProduct.getInstance(databaseName);
  const tables: Glue.Table[] = await glueDataProduct.getTablesStartingWith(tablePrefix);

  if (!tables || tables.length === 0) {
    // error will be handled by step functions
    throw new VError(
      { name: 'TablePrefixNotFoundError' },
      `Tables with prefix ${tablePrefix} not found in database ${databaseName}`,
    );
  }

  /**
   * Current transform folder structure diverges from source by 2 folders, which causes Glue crawler to
   * automatically generate 2 partition keys (partition_0, and partition_1) for some transform cases.
   * The solution does not current implement optimization around partitions, which is slated for following
   * release, so we can safely drop these partitions. By leaving the partitions, Glue transform jobs
   * creates duplicate partition columns in the schema, which results in failed query execution.
   */
  for (const table of tables) {
    if (table.PartitionKeys?.length) {
      // List of partition key names that glue generates that will be dropped
      const partitionKeysToDrop = table.PartitionKeys.filter(
        (_key) =>
          EXTRANEOUS_PARTITION_KEY_PATTERN.test(_key.Name) || _key.Name === DATA_PRODUCT_APPEND_DATA_PARTITION_KEY,
      ).map(({ Name }) => Name);

      // List of partition key names we want to preserve (such as year,month,day for kinesis)
      const partitionKeysToPreserve = table.PartitionKeys.filter(
        (_key) => !partitionKeysToDrop.includes(_key.Name),
      ).map(({ Name }) => Name);

      // Table PartitionKeys that should remain and be updated on the table
      const partitionKeys = table.PartitionKeys.filter((_key) => partitionKeysToPreserve.includes(_key.Name));

      if (partitionKeys.length === table.PartitionKeys.length) {
        log.info(`Preserving partition keys ${partitionKeysToPreserve.join(',')}`, {
          table: pick(table, ['DatabaseName', 'Name'] as (keyof Glue.Table)[]),
          partitionKeys,
        });
        // No partition keys to drop for this table, so ignore any changes
        continue;
      }

      log.info(`Removing partition keys ${partitionKeysToDrop.join(',')}`, {
        table: pick(table, ['DatabaseName', 'Name'] as (keyof Glue.Table)[]),
        partitionKeys: {
          original: table.PartitionKeys,
          updated: partitionKeys,
        },
      });

      // remove dropped partition keys from columns
      const columns =
        table.StorageDescriptor?.Columns &&
        table.StorageDescriptor.Columns.filter((_column) => {
          return !partitionKeysToDrop.includes(_column.Name);
        });

      try {
        // glue crawler started to add partition index automatically which prevent removing the partition columns.
        // delete this partition index first before update.
        await glue
          .deletePartitionIndex({
            CatalogId: table.CatalogId,
            DatabaseName: databaseName,
            TableName: table.Name,
            IndexName: 'crawler_partition_index',
          })
          .promise();

        await glue
          .updateTable({
            CatalogId: table.CatalogId,
            DatabaseName: databaseName,
            TableInput: {
              ...pick(table, UPDATE_TABLE_KEYS),
              // replace partition keys with only preservered keys
              PartitionKeys: partitionKeys,
              // filter out partition columns (they should not exist here)
              StorageDescriptor: {
                ...table.StorageDescriptor,
                Columns: columns,
              },
            },
          })
          .promise();
      } catch (error: any) {
        log.error(error, { databaseName, tableName: table.Name });
      }

      if (columns) {
        // propagate dropped partition keys from columns passed in results
        table.StorageDescriptor!.Columns = columns;
      }
    }
  }

  return {
    ...event.Payload,
    // if there is no ingestion timestamp from the input, it means that the prepareImportExternal is not used and
    // the start crawler is not reading from the S3 location (could be JDBC connection), therefore there is no ingestion time
    // supplied from the previous step. In this case, set the ingestion timestamp to current time and pass it down the transform chain
    ingestionTimestamp: ingestionTimestamp ?? Date.now().toString(),
    tableDetails: tables.map((table) => ({
      tableName: table.Name,
      tableNameSuffix: table.Name.replace(tablePrefix, ''),
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: databaseName,
        table: table.Name,
      },
      columns: table
        .StorageDescriptor!.Columns!.filter((q) => q.Name !== '_ada_internal') // filter internal columns used by Ada
        .map((c) => ({ name: c.Name, type: c.Type! })),
      compressed: table.StorageDescriptor!.Compressed!,
      location: table.StorageDescriptor!.Location!,
      classification: table.Parameters!.classification,
      recordCount: Number(table.Parameters!.recordCount),
      averageRecordSize: Number(table.Parameters!.averageRecordSize),
      compressionType: table.Parameters!.compressionType,
    })),
  };
};
