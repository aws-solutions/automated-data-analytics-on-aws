/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { JSONSchema7 } from 'json-schema';
import type { UiSchema } from '@rjsf/core';

export type TransformSchemaExtension = UiSchema;

type TransformSchemaDefinition = TransformSchema | boolean;

/**
 * Schema definition for transform scripts. Extension of `JSONSchema7` with
 * added support for react-jsonschema-form `UiSchema`.
 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01
 * @see https://react-jsonschema-form.readthedocs.io/en/latest/api-reference/uiSchema/
 */
export interface TransformSchema extends JSONSchema7, TransformSchemaExtension {
  items?: TransformSchemaDefinition | TransformSchemaDefinition[];
  additionalItems?: TransformSchemaDefinition;
  contains?: TransformSchema;
  properties?:{ [key: string]: TransformSchemaDefinition };
  patternProperties?: { [key: string]: TransformSchemaDefinition };
  additionalProperties?: TransformSchemaDefinition;
  dependencies?: { [key: string]: TransformSchemaDefinition | string[] };
  propertyNames?: TransformSchemaDefinition;

  if?: TransformSchemaDefinition;
  then?: TransformSchemaDefinition;
  else?: TransformSchemaDefinition;

  allOf?: TransformSchemaDefinition[];
  anyOf?: TransformSchemaDefinition[];
  oneOf?: TransformSchemaDefinition[];
  not?: TransformSchemaDefinition;

  definitions?: {
    [key: string]: TransformSchemaDefinition;
  };
}
