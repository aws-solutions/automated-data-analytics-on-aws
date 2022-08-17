/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export type { JsonSchema } from 'aws-cdk-lib/aws-apigateway';

// NOTE: re-declaring JsonSchema enums here to prevent importing code from @aws-cdk just for types

/**
 * @stability stable
 */
export enum JsonSchemaVersion {
  /**
   * In API Gateway models are defined using the JSON schema draft 4.
   *
   * @see https://tools.ietf.org/html/draft-zyp-json-schema-04
   * @stability stable
   */
  DRAFT4 = 'http://json-schema.org/draft-04/schema#',
  /**
   * @stability stable
   */
  DRAFT7 = 'http://json-schema.org/draft-07/schema#',
}

/**
 * @stability stable
 */
export enum JsonSchemaType {
  /**
   * @stability stable
   */
  NULL = 'null',
  /**
   * @stability stable
   */
  BOOLEAN = 'boolean',
  /**
   * @stability stable
   */
  OBJECT = 'object',
  /**
   * @stability stable
   */
  ARRAY = 'array',
  /**
   * @stability stable
   */
  NUMBER = 'number',
  /**
   * @stability stable
   */
  INTEGER = 'integer',
  /**
   * @stability stable
   */
  STRING = 'string',
}
