/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import { DataIntegrity, DataProductAccess, LensIds } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

export const LensProperty: JsonSchema = {
  id: `${__filename}/LensEnum`,
  type: JsonSchemaType.STRING,
  description: 'Lens value',
  enum: Object.values(LensIds),
};

export const AccessProperty: JsonSchema = {
  id: `${__filename}/AccessEnum`,
  type: JsonSchemaType.STRING,
  description: 'Access control value',
  enum: Object.values(DataProductAccess),
};

export const SourceTypeProperty: JsonSchema = {
  id: `${__filename}/SourceTypeEnum`,
  type: JsonSchemaType.STRING,
  description: 'Source type value',
  enum: Object.values(Connectors.Id),
};

export const DataIntegrityProperty: JsonSchema = {
  id: `${__filename}/DataIntegrityEnum`,
  type: JsonSchemaType.STRING,
  description: 'Data Integrity value',
  enum: Object.values(DataIntegrity),
};
