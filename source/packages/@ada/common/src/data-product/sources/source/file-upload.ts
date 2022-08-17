/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceType } from '../core';
import { JsonSchema, JsonSchemaType, JsonSchemaVersion, S3Location, extendSchema } from '../../../api';

/**
 * The input details for file upload
 */
export type SourceDetailsFileUpload = S3Location;

/**
 * The input details for file upload
 */
export const SourceDetailsFileUpload: JsonSchema = extendSchema( //NOSONAR (S2814:Duplicate) - false positive - type vs value
  {
    id: `${__filename}/SourceDetailsFileUpload`,
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
  },
  S3Location,
);

const UPLOAD_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.UPLOAD,
  CONFIG: {
    enabled: true,
    supports: {
      preview: true,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: false,
      updateTriggerScheduleRate: null,
    },
  },
  SCHEMA: SourceDetailsFileUpload,
};

export { UPLOAD_SOURCE_DEFINITION, UPLOAD_SOURCE_DEFINITION as default };
