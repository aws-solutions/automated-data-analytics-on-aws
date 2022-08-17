/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, DataProductUpdatePolicy, SourceType } from '../core';
import { JsonSchema, JsonSchemaType, JsonSchemaVersion, SQL_CLAUSE_VALIDATION } from '../../../api';

/**
 * Input details required for a query source data product
 */
export interface SourceDetailsQuery {
  query: string;
  updateType: DataProductUpdatePolicy;
}

/**
 * The input details for file upload
 */
export const SourceDetailsQuery: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/SourceDetailsQuery`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    query: { type: JsonSchemaType.STRING, ...SQL_CLAUSE_VALIDATION },
    updateType: { type: JsonSchemaType.STRING, enum: Object.values(DataProductUpdatePolicy) },
  },
  required: ['query', 'updateType'],
};

const QUERY_SOURCE_DEFINITION: DataProductSourceDefinition = {
  TYPE: SourceType.QUERY, //NOSONAR (S1874:Deprecated) - ignore
  CONFIG: {
    enabled: false, // DISABLED
    supports: {
      preview: true,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: false,
        ON_DEMAND: false,
        SCHEDULE: false,
      },
      updateTriggerScheduleRate: null,
    },
  },
  SCHEMA: SourceDetailsQuery,
};

export { QUERY_SOURCE_DEFINITION, QUERY_SOURCE_DEFINITION as default };
