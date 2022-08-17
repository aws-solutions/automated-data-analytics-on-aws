/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as dotobject from 'dot-object';
import { DataProductPreview, DataSetPreviewSchema } from '@ada/api';
import { FieldSet } from '../types';
import { GlueDataTypes } from '@ada/common';
import { SelectOption } from 'aws-northstar/components/Select';
import { TransformSchema } from '@ada/transforms';
import { UiSchema } from '@rjsf/core';
import { cloneDeep } from 'lodash';

export function MergedFieldSet(set1: FieldSet | string[], set2: FieldSet | string[]): FieldSet {
  return new Set<string>([...set1, ...set2]);
}

export function extractUiSchema(inputSchema: TransformSchema, defaults: UiSchema = {}): UiSchema {
  const flat = {};
  const uiSchema = cloneDeep(defaults);
  dotobject.dot(inputSchema, flat);
  Object.entries(flat).forEach(([key, value]) => {
    key = key.replace(/properties\./g, '');
    dotobject.set(key, value, uiSchema, true);
  });
  return uiSchema;
}

// If the source column has dots ".", square brackets "[]" or parentheses "()" in the name, the mapping will not work unless you place back-ticks "``" around it.
// https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-crawler-pyspark-transforms-ApplyMapping.html
const ESCAPE_REGEX = /[\.\[\]\(\)]/;
function escapeFieldName(name: string): string {
  if (ESCAPE_REGEX.test(name)) return `\`${name}\``;
  return name;
}

function extractFieldsFromStruct(fields: Required<DataSetPreviewSchema>['fields'], parentPath?: string): FieldSet {
  return fields.reduce((fieldSet, field) => {
    const name = parentPath ? `${parentPath}.${escapeFieldName(field.name)}` : escapeFieldName(field.name);
    fieldSet.add(name);

    if (field.container?.dataType === GlueDataTypes.struct && field.container.fields) {
      return MergedFieldSet(fieldSet, extractFieldsFromStruct(field.container.fields, name));
    }
    return fieldSet;
  }, new Set<string>());
}

export function interpolateFieldEntriesFromDataSetPreviewSchema(
  _dataSet: string,
  schema: DataSetPreviewSchema,
): FieldSet {
  if (schema.dataType === GlueDataTypes.struct && schema.fields) {
    return extractFieldsFromStruct(schema.fields);
  } else {
    return new Set();
  }
}

export function interpolateFieldEntriesFromPreview(preview?: DataProductPreview): FieldSet {
  if (preview == null) return new Set();

  return MergedFieldSet(
    Object.entries(preview.initialDataSets || {}).reduce((fieldSet, [key, dataSetPreview]) => {
      return MergedFieldSet(fieldSet, interpolateFieldEntriesFromDataSetPreviewSchema(key, dataSetPreview.schema));
    }, new Set<string>()),
    Object.entries(preview.transformedDataSets || {}).reduce((fieldSet, [key, dataSetPreview]) => {
      return MergedFieldSet(fieldSet, interpolateFieldEntriesFromDataSetPreviewSchema(key, dataSetPreview.schema));
    }, new Set<string>()),
  );
}

export function fieldOptionsFromFieldSet(fieldSet: FieldSet): SelectOption[] {
  return Array.from(fieldSet)
    .sort()
    .map((field) => ({
      label: field,
      value: field,
    }));
}
