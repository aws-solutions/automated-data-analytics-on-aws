/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BUCKET_KEY_VALIDATION, BUCKET_NAME_VALIDATION, TAG_KEY_VALIDATION, TAG_VALUE_VALIDATION } from './validation';
import { JsonSchema, JsonSchemaType, JsonSchemaVersion } from './json-schema';
import { cloneSchema } from './schema-utils';

export interface S3Location {
  bucket: string;
  key: string;
}

export const S3Location: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/S3Location`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    bucket: { type: JsonSchemaType.STRING, ...BUCKET_NAME_VALIDATION },
    key: { type: JsonSchemaType.STRING, ...BUCKET_KEY_VALIDATION },
  },
  required: ['bucket', 'key'],
};

export interface GSLocation extends S3Location {}

export const GSLocation = cloneSchema(S3Location, { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/GSLocation`,
});

/**
 * A tag is a key/value pair
 */
export const Tag: JsonSchema = {
  id: `${__filename}/Tag`,
  type: JsonSchemaType.OBJECT,
  properties: {
    key: TAG_KEY_VALIDATION,
    value: TAG_VALUE_VALIDATION,
  },
  required: ['key'],
};

/**
 * A list of tags
 */
export const Tags: JsonSchema = {
  id: `${__filename}/Tags`,
  type: JsonSchemaType.ARRAY,
  items: { ref: '#/definitions/Tag' }, // can't use `asRef(Tag)` since utils depends on common - circular def
  definitions: {
    Tag,
  },
};

/**
 * Dereferenced schema validation for browser based validation.
 * `id` is missing to ensure not used by backend
 * NOTE: enable browser based dereferencing to improve this - currently node support or very old browser libs that
 * do not meet our requirements.
 */
export const TagsDefref: JsonSchema = {
  type: JsonSchemaType.ARRAY,
  items: {
    ...Tag,
  },
};
