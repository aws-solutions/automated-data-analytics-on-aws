/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { VError } from 'verror';

/**
 * These sql utilities are intended for very simple sql query manipulation/construction. For more complex use cases,
 * consider implementing in Java as part of query parse/render service.
 */

// Formats supported by athena for CTAS queries
export type CtasDataFormat = 'JSON' | 'PARQUET' | 'AVRO' | 'ORC' | 'TEXTFILE';

export interface CtasProps {
  selectQuery: string;
  database: string;
  tableName: string;
  outputS3Path: string;
  format?: CtasDataFormat;
}

/**
 * Build a create table as select query from the given select query
 */
export const buildCtasQuery = ({
  database,
  tableName,
  selectQuery,
  format,
  outputS3Path,
}: CtasProps): string => `CREATE TABLE "${database}"."${tableName}"
WITH (
  external_location = '${outputS3Path}',
  format = '${format || 'PARQUET'}'
) AS (${selectQuery})`;

export interface DropTableProps {
  database: string;
  tableName: string;
}

const wrapWithBackticks = (s: string) => '`' + s + '`';

/**
 * Build a drop table query to delete a table in glue
 */
export const buildDropTableQuery = ({ database, tableName }: DropTableProps): string =>
  `DROP TABLE ${wrapWithBackticks(database)}.${wrapWithBackticks(tableName)}`;

export interface ColumnDescriptor {
  name: string;
  type: string;
}

export interface ExternalTableProps {
  database: string;
  tableName: string;
  columns: ColumnDescriptor[];
  classification: string;
  s3Path: string;
  metadata?: unknown;
}

interface Property {
  key: string;
  value: string;
}

type TableProperty = Property;

type SerDeProperty = Property;
interface ClassificationSpecificExternalTableConfiguration {
  serDeProperties?: SerDeProperty[];
  tableProperties: TableProperty[];
  rowFormat: string;
}

const buildClassificationSpecificExternalTableConfiguration = (
  classification: string,
  metadata?: any,
): ClassificationSpecificExternalTableConfiguration => {
  switch (classification) {
    case 'csv':
      return {
        rowFormat: `ROW FORMAT DELIMITED FIELDS TERMINATED BY '${metadata?.delimiter || ','}'`,
        tableProperties: [{ key: 'skip.header.line.count', value: '1' }],
      };
    case 'json':
      return {
        rowFormat: `ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'`,
        serDeProperties: [{ key: 'ignore.malformed.json', value: 'true' }],
        tableProperties: [],
      };
    case 'parquet':
      return {
        rowFormat: `STORED AS PARQUET`,
        tableProperties: [],
      };
    default:
      throw new VError({ name: 'UnsupportedDataTypeError' }, `Unsupported data type ${classification}`);
  }
};
const renderProperties = (properties: Property[]): string =>
  properties.map(({ key, value }) => `'${key}'='${value}'`).join(',');

export const buildCreateExternalTableQuery = ({
  database,
  tableName,
  columns,
  classification,
  s3Path,
  metadata,
}: ExternalTableProps): string => {
  const { tableProperties, serDeProperties, rowFormat } = buildClassificationSpecificExternalTableConfiguration(
    classification,
    metadata,
  );
  const renderedTableProperties = renderProperties(
    [{ key: 'classification', value: classification }].concat(tableProperties),
  );
  const renderedSerDeProperties = serDeProperties?.length
    ? ` WITH SERDEPROPERTIES (${renderProperties(serDeProperties)})`
    : '';
  // NB: Query fails if we escape the database and table name, so they are expected to include only alphanumerics
  // and underscores
  const columnNames = columns.map(({ name, type }) => `\`${name}\` ${type}`).join(',');
  const s3Location = s3Path.endsWith('/') ? s3Path : `${s3Path}/`;
  return `CREATE EXTERNAL TABLE ${database}.${tableName} (${columnNames}) ${rowFormat}${renderedSerDeProperties} LOCATION '${s3Location}' TBLPROPERTIES (${renderedTableProperties})`;
};
