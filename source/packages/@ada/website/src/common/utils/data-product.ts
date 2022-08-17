/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Column } from 'aws-northstar/components/Table';
import { ColumnMetadata } from '@ada/api-client/models/ColumnMetadata';
import { ColumnsMetadata, DataProduct, DataProductIdentifier, DataSetPreviewSchema, QueryResultData } from '@ada/api';
import { DataSetIds } from '@ada/common';
import isObject from 'lodash/isObject';
import maxBy from 'lodash/maxBy';
import take from 'lodash/take';
import truncate from 'lodash/truncate';

export function getDataProductSQLIdentitier(identifier: DataProductIdentifier): string {
  return `${identifier.domainId}.${identifier.dataProductId}`;
}

export function getDataProductSourceSQLIdentitier(identifier: DataProductIdentifier): string {
  return `source.${identifier.domainId}.${identifier.dataProductId}`;
}

export function dataProductIdentifier({ domainId, dataProductId }: DataProduct): DataProductIdentifier {
  return { domainId, dataProductId };
}

export function dataSetIdCompareFn(a: string, b: string): number {
  if (a === DataSetIds.DEFAULT) {
    return -1;
  } else if (b === DataSetIds.DEFAULT) {
    return 1;
  } else {
    return a < b ? -1 : 1;
  }
}

/**
 * Sorts data set ids: default first, then lexicographic order
 * @param dataSetIds the dataset ids to sort
 */
export const sortDataSetIds = (dataSetIds: string[]): string[] => dataSetIds.sort(dataSetIdCompareFn); //NOSONAR (typescript:S4043) false positive

const buildFlatDataType = (schema: DataSetPreviewSchema): string => {
  const getFieldList = () =>
    schema.fields!.map((field) => `${field.name}: ${buildFlatDataType(field.container!)}`).join(', ');

  switch (schema.dataType) {
    case 'struct':
      return `struct { ${getFieldList()} }`;
    case 'array':
      return `array<${buildFlatDataType(schema.elementType!)}>`;
    default:
      return schema.dataType;
  }
};

export const previewSchemaToColumnMetadata = (previewSchema: DataSetPreviewSchema): ColumnsMetadata => {
  if (previewSchema.dataType === 'struct' && previewSchema.fields !== undefined) {
    return Object.fromEntries(
      previewSchema.fields.map((field, i) => [
        field.name,
        {
          dataType: buildFlatDataType(field.container!),
          sortOrder: i,
        },
      ]),
    );
  }
  return {};
};

export const columnMetadataToList = (columnMetadata: ColumnsMetadata): (ColumnMetadata & { name: string })[] => {
  return Object.entries(columnMetadata).map(([name, metadata]) => ({
    name,
    ...metadata,
  }));
};

export const sanitiseTableValue = (value: any, truncateLength?: number) => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  let returnValue = value;
  if (isObject(value)) {
    returnValue = JSON.stringify(value);
  }
  return truncateLength ? truncate(returnValue, { length: truncateLength }) : returnValue;
};

/**
 * Ensure that the keys in every result are compatible with northstar table 'accessor's.
 * @param data query result data
 * @param truncateLength truncate each value to this length if provided, otherwise leave the value as-is
 */
export const sanitiseDataForTable = (data: (QueryResultData | object)[], truncateLength?: number): QueryResultData[] =>
  data.map((item) =>
    Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key.replace(/\./g, '_'), sanitiseTableValue(value, truncateLength)]),
    ),
  );

/**
 * Ensure that the column id and accessor are compatible with northstar table 'accessor's.
 * @param colName
 * @returns
 */
export const sanitiseAccessorForTable = (colName: string): string => colName?.replace(/\./g, '_');

/**
 * Generate table column definitions from query results.
 * Uses up to the first 10 rows provided to find the result with the most columns to generate the definitions from
 */
export const generateDataColumnDefinitions = (data: (QueryResultData | object)[]) =>
  Object.keys(maxBy(sanitiseDataForTable(take(data, 10)), (d) => Object.keys(d).length) || {}).map(
    (key) =>
      ({
        accessor: key,
        id: key,
        Header: key,
      } as Column<object>),
  );
