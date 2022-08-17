/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DESCRIPTION_VALIDATION, ID_VALIDATION, NAME_VALIDATION } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

/**
 * Schema for a UDF
 */
export const UDF: JsonSchema = {
  id: `${__filename}/UDF`,
  type: JsonSchemaType.OBJECT,
  properties: {
    name: { type: JsonSchemaType.STRING, ...NAME_VALIDATION },
    inputType: { type: JsonSchemaType.STRING, ...NAME_VALIDATION },
    outputType: { type: JsonSchemaType.STRING, ...NAME_VALIDATION },
  },
  required: ['name', 'inputType', 'outputType'],
};

/**
 * Schema for a lens
 */
export const Lens: JsonSchema = {
  id: `${__filename}/Lens`,
  type: JsonSchemaType.OBJECT,
  properties: {
    lensId: {
      type: JsonSchemaType.STRING,
      ...ID_VALIDATION,
    },
    name: {
      type: JsonSchemaType.STRING,
      ...NAME_VALIDATION,
    },
    description: {
      type: JsonSchemaType.STRING,
      ...DESCRIPTION_VALIDATION,
    },
  },
  required: ['lensId', 'name', 'description'],
};
