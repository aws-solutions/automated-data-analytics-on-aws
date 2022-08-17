/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ColumnsMetadata, DataSetPreviewSchema } from '@ada/api-client';

const toAthenaDataType = (dataType: string) => {
  // Convert from type from data wrangler (ie glue type) to valid athena type
  // Ref: https://docs.aws.amazon.com/databrew/latest/dg/datatypes.html
  // Ref: https://docs.aws.amazon.com/athena/latest/ug/data-types.html
  // assumption: each field is wrangled to the same data type, then system cast it to the largest value type
  // in order to support mix data types, we need to use better sampling mechanism instead of top N
  switch (dataType) {
    case 'byte':
    case 'short':
    case 'int':
    case 'long':
      return 'bigint';
    case 'float':
    case 'double':
    case 'decimal':
      return 'double';
    case 'null':
      return 'string';
    default:
      return dataType;
  }
};

export const buildFlatDataType = (schema: DataSetPreviewSchema): string => {
  switch (schema.dataType) {
    // empty object {} compiles into to  empty struct<> Athena does not support, replace with string instead.
    case 'struct':
      return schema.fields!.length > 0
        ? 'struct<' +
            schema.fields!.map((field) => `${field.name}: ${buildFlatDataType(field.container!)}`).join(', ') +
            '>'
        : 'string';
    case 'array':
      return `array<${buildFlatDataType(schema.elementType!)}>`;
    default:
      return toAthenaDataType(schema.dataType);
  }
};

export const previewSchemaToColumnMetadata = (previewSchema: DataSetPreviewSchema): ColumnsMetadata => {
  if (previewSchema.dataType === 'struct' && previewSchema.fields !== undefined) {
    return Object.fromEntries(
      previewSchema.fields.map((field, i) => [
        field.name,
        {
          dataType: buildFlatDataType(field.container!),
          // Preview schema is ordered, so preserve this order in the column metadata
          sortOrder: i,
        },
      ]),
    );
  }
  return {};
};
