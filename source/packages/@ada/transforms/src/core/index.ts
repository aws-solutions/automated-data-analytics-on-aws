/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductTransform } from '@ada/api';
import { TransformSchema } from './schema';

export * from './schema';

export type TransformSource = string;

export type TransformAutomaticClassification = 'json' | 'parquet';

export interface TransformDefinition {
  /** Namespace in which the transform resides (eg domain) */
  namespace: string;
  /** UUID of the transform used to reference */
  id: string;
  /** Handler source path */
  source: TransformSource;
  /** Name of the transform */
  name: string;
  /** Description of the transform */
  description: string;
  /** Additional help info or URL link to the external docucumentation for the tranform - usually built-in glue link. */
  helperText?: string;
  /** Schema definition for the input args and rendering of the ui elements */
  inputSchema?: Omit<TransformSchema, 'type'> & {
    // only support "object" for root type of inputArgs
    type: 'object';
  };
  /** Indicates classifications in which transform may be automatically applied. */
  applicableClassifications?: TransformAutomaticClassification[];
}

export interface AutomaticTransform extends DataProductTransform {
  readonly applicableClassifications: string[];
}

export interface FieldMappingSchema {
  oldName: string;
  newName: string;
  newType: string;
}

export const FIELD_SELECTOR_HINT =
  'HINT: Listed field names might not match current schema at placement of tranform. Use freeform text to input any field name value.';
