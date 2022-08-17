/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceType } from '../core';
import {
  GOOGLE_ANALYTICS_SOURCE_DEFINITION,
  GOOGLE_BIGQUERY_SOURCE_DEFINITION,
  GOOGLE_STORAGE_SOURCE_DEFINITION,
  SourceDetailsGoogleAnalytics,
  SourceDetailsGoogleBigQuery,
  SourceDetailsGoogleStorage,
} from './google';
import {
  JsonSchema,
  JsonSchemaType,
  JsonSchemaVersion,
  idModelName,
  normalizeSchema,
} from '../../../api';
import { KINESIS_SOURCE_DEFINITION, SourceDetailsKinesis } from './kinesis';
import { QUERY_SOURCE_DEFINITION } from './query';
import { S3_SOURCE_DEFINITION, SourceDetailsS3 } from './s3';
import { SourceDetailsFileUpload, UPLOAD_SOURCE_DEFINITION } from './file-upload';
import { last } from 'lodash';

export * from './s3';

export * from './file-upload';

export * from './kinesis';

export * from './query';

export * from './google';

export const SourceTypeDefinitions: Record<SourceType, DataProductSourceDefinition> = {
  S3: S3_SOURCE_DEFINITION,
  UPLOAD: UPLOAD_SOURCE_DEFINITION,
  KINESIS: KINESIS_SOURCE_DEFINITION,
  QUERY: QUERY_SOURCE_DEFINITION,
  GOOGLE_ANALYTICS: GOOGLE_ANALYTICS_SOURCE_DEFINITION,
  GOOGLE_BIGQUERY: GOOGLE_BIGQUERY_SOURCE_DEFINITION,
  GOOGLE_STORAGE: GOOGLE_STORAGE_SOURCE_DEFINITION,
};

export const SUPPORTED_SOURCE_TYPES: SourceType[] = Object.values(SourceTypeDefinitions).reduce((supported, def) => {
  if (def.CONFIG.enabled) return supported.concat([def.TYPE]);
  return supported;
}, [] as SourceType[]);

export const GOOGLE_SOURCE_TYPES = [
  GOOGLE_ANALYTICS_SOURCE_DEFINITION.TYPE,
  GOOGLE_BIGQUERY_SOURCE_DEFINITION.TYPE,
  GOOGLE_STORAGE_SOURCE_DEFINITION.TYPE,
]

/**
 * Union of google specific source details
 */
export type SourceDetailsGoogleXXX =
  | SourceDetailsGoogleStorage
  | SourceDetailsGoogleBigQuery
  | SourceDetailsGoogleAnalytics;

/**
 * Type for any data product source details
 */
export type SourceDetails =
  | SourceDetailsS3
  | SourceDetailsFileUpload
  | SourceDetailsKinesis
  // SourceDetailsQuery |
  | SourceDetailsGoogleAnalytics
  | SourceDetailsGoogleBigQuery
  | SourceDetailsGoogleStorage;

/**
 * The input details for file upload
 */
export const SouceDetailsSchema: JsonSchema = normalizeSchema({
  id: `${__filename}/SouceDetailsSchema`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  ...Object.values(SourceTypeDefinitions).reduce(
    (schema, def) => {
      if (def.CONFIG.enabled) {
        Object.assign(schema.properties, getSourceTypeFlatPropertiesMap(def.TYPE));

        Object.assign(schema.definitions, {
          [idModelName(def.SCHEMA.id!)]: def.SCHEMA,
        })
      }
      return schema;
    },
    { properties: {}, definitions: {} } as Required<Pick<JsonSchema, 'properties' | 'definitions'>>,
  ),
});

/**
 * Gets flattened JsonSchema properties definition for a given source type.
 *
 * This will extract/dereference nested properties from `allOf` field to create a flat object of properties.
 * @param sourceType `SouceType`
 * @returns `Map<string, JsonSchema>` - Map of property name to schema definition.
 */
export function getSourceTypeFlatPropertiesMap (sourceType: SourceType): Required<JsonSchema>['properties'] {
  const schema = SourceTypeDefinitions[sourceType].SCHEMA;
  const _properties: Required<JsonSchema>['properties'] = {};

  Object.assign(_properties, schema.properties);

  // Extract properties from 'allOf' definitions
  Object.assign(_properties, schema.allOf?.reduce((_accumProperties, _allOf) => {
    Object.assign(_accumProperties, _allOf.properties);
    if (_allOf.ref) {
      Object.assign(_accumProperties, schema.definitions![last(_allOf.ref.split('/'))!].properties);
    }
    return _accumProperties
  }, {}));

  return _properties;
}

/**
 * Gets list of property names for a given source type.
 * @param sourceType `SouceType`
 * @returns `string[]` - List of properties names.
 */
export function getSourceTypePropertyNames (sourceType: SourceType): string[] {
  return Object.keys(getSourceTypeFlatPropertiesMap(sourceType) || {});
}
