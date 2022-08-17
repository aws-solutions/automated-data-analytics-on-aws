/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaType } from './json-schema';

export const ID_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[a-z][a-z_0-9]*$',
  minLength: 2,
  maxLength: 256,
};

/** Namespaced identifier is dot separate set of ids */
export const NAMESPACED_ID_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[a-z][a-z_0-9]*.[a-z][a-z_0-9]*$',
  minLength: 5,
  maxLength: 512,
};

export const BUCKET_NAME_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[a-z0-9]+[a-z0-9-]+[a-z0-9]+$',
  minLength: 3,
  maxLength: 63,
};

export const BUCKET_KEY_VALIDATION: Partial<JsonSchema> = {
  // https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html#object-key-guidelines
  pattern: `^[a-zA-Z0-9!_.*'()-]+(/[a-zA-Z0-9!_.*'()-]+)*$`,
  minLength: 1,
  maxLength: 1024,
};

export const S3_OBJECT_PATH_REGEX = /^s3:\/\/([a-z0-9]+[a-z0-9-]+[a-z0-9]+)(\/([a-zA-Z0-9!_.*'()-]+(\/[a-zA-Z0-9!_.*'()-]+)*))$/ //NOSONAR (S2814:Duplicate) - false positive

export const S3_OBJECT_PATH_VALIDATION: Partial<JsonSchema> = {
  pattern: S3_OBJECT_PATH_REGEX.source,
  minLength: 's3://'.length + BUCKET_NAME_VALIDATION.minLength! + BUCKET_KEY_VALIDATION.minLength!,
  maxLength: 's3://'.length + BUCKET_NAME_VALIDATION.maxLength! + 1 + BUCKET_KEY_VALIDATION.maxLength!,
};


export const USER_IDENTIFIER_VALIDATION: Partial<JsonSchema> = {
  pattern: '[\\w\\s+=.@-]+',
  maxLength: 256,
};

export const NAME_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[\\w _-]*$',
  minLength: 2,
  maxLength: 2048,
};

export const DATA_TYPE_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[\\w _\\{\\}"<>:,-]*$',
  maxLength: 2048,
};

export const DESCRIPTION_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[\\w+ _.:,\\/*&%$#=+-@?!|()"\'\\]\\[]*$',
  maxLength: 2048,
};

export const TAG_KEY_VALIDATION_REGEX = /^([a-zA-Z][a-zA-Z0-9_.:/=+-@]{0,127})$/; //NOSONAR (S5869) - false positive on duplicate

export const TAG_KEY_VALIDATION: Partial<JsonSchema> = {
  type: JsonSchemaType.STRING,
  pattern: TAG_KEY_VALIDATION_REGEX.source,
  minLength: 1,
  maxLength: 128,
};

export const TAG_VALUE_VALIDATION_REGEX = /^([a-zA-Z0-9_.:/=+-@]{0,256})$/; //NOSONAR (S5869) - false positive on duplicate

export const TAG_VALUE_VALIDATION: Partial<JsonSchema> = {
  type: JsonSchemaType.STRING,
  pattern: TAG_VALUE_VALIDATION_REGEX.source,
  minLength: 0,
  maxLength: 256,
};

// https://regexr.com/6f6vv
export const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?))?$/; //NOSONAR (duplicates)

export const DATE_VALIDATION: Partial<JsonSchema> = {
  pattern: DATE_REGEX.source,
  maxLength: 64,
};

export const API_ARN_VALIDATION: Partial<JsonSchema> = {
  pattern: '^arn:[^:]+:execute-api:[^:]+:[0-9]+:[^\\/]+\\/.*$',
  maxLength: 2048,
};

export const ARN_RESOURCE_VALIDATION: Partial<JsonSchema> = {
  pattern: '^arn:[\\w]+:[\\w-]+:[\\w-]+:[\\d]+:[*-\\/\\w]+$',
  maxLength: 2048,
};

// https://regexr.com/6f6u6
export const RATE_EXPRESSION_REGEX = /^rate\((\d+) (minutes?|hours?|days?)\)$/;

export const RATE_EXPRESSION_VALIDATION: Partial<JsonSchema> = {
  pattern: RATE_EXPRESSION_REGEX.source,
  maxLength: 64,
};

// https://regexr.com/6f6uc
export const CRON_EXPRESSION_REGEX = /^cron\(([\w,/\-*?#]{1,20} ?){1,6}\)$/;

export const CRON_EXPRESSION_VALIDATION: Partial<JsonSchema> = {
  pattern: CRON_EXPRESSION_REGEX.source,
  maxLength: 64,
};

export const SCHEDULE_RATE_VALIDATION: Partial<JsonSchema> = {
  // https://regexr.com/6f6ul
  pattern: `(?:(?:${RATE_EXPRESSION_REGEX.source})|(?:${CRON_EXPRESSION_REGEX.source}))`,
  maxLength: 64,
};

export const INLINE_SCRIPT_VALIDATION: Partial<JsonSchema> = {
  pattern: '^[\\s\\S]*def apply_transform\\([\\s\\S]*$',
  maxLength: 262144,
};

export const SQL_CLAUSE_VALIDATION: Partial<JsonSchema> = {
  pattern: '^([\\s\\S]+)$',
  // athena max query size
  maxLength: 262144,
};

// https://cloud.google.com/storage/docs/naming-buckets
// https://cloud.google.com/storage/docs/naming-objects
// https://regexr.com/6nudl
export const GOOGLE_STORAGE_PATH_REGEX = /^gs:\/\/([a-z\d][a-z\d_\-.]{2,35})(\/[\S ]{1,1024})?$/

export const GOOGLE_STORAGE_PATH_VALIDATION: Partial<JsonSchema> = {
  pattern: GOOGLE_STORAGE_PATH_REGEX.source,
  minLength: 'gs://'.length + 3,
  maxLength: 'gs://'.length + 36 + 1 + 1024,
};
