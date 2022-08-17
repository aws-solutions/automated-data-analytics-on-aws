/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FIELD_SELECTOR_HINT, TransformDefinition } from '../../core';
import { GlueDataTypes, JsonSchemaType, ReservedDomains } from '@ada/common';
import { TransformFields } from '../../ui';

export const ID = 'ada_apply_mapping';

export const transform: TransformDefinition = {
  namespace: ReservedDomains.GLOBAL,
  id: ID,
  name: 'Apply Mapping',
  description: 'Map field name and data types',
  helperText: 'https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-crawler-pyspark-transforms-ApplyMapping.html',
  source: `${__dirname}/apply_mapping.py`,
  inputSchema: {
    type: JsonSchemaType.OBJECT,
    'ui:order': ['drop_fields', 'mappings'],
    required: ['drop_fields', 'mappings'],
    properties: {
      drop_fields: {
        type: JsonSchemaType.BOOLEAN,
        title: 'Drop other fields',
        description: 'Indicates if fields not specified in mapping are dropped from schema.',
        default: true,
        'ui:description': 'Indicates if fields not specified in mapping are dropped from schema.',
        'ui:help': 'HINT: Uncheck to preserve unmapped fields.',
      },
      mappings: {
        type: JsonSchemaType.ARRAY,
        title: 'Field Mappings',
        description: 'Add new item to map field name and data type',
        'ui:help': FIELD_SELECTOR_HINT,
        minItems: 1,
        items: {
          type: JsonSchemaType.OBJECT,
          'ui:field': TransformFields.SCHEMA_FIELD_MAPPING,
          'ui:order': ['oldName', 'newName', 'newType'],
          required: ['oldName', 'newName', 'newType'],
          properties: {
            oldName: {
              title: 'Source Name',
              type: JsonSchemaType.STRING,
            },
            newName: {
              title: 'Target Name',
              type: JsonSchemaType.STRING,
            },
            newType: {
              title: 'Target Type',
              type: JsonSchemaType.STRING,
              enum: Object.values(GlueDataTypes).map((type) => type.toLowerCase()),
            },
          },
        },
      },
    },
  },
};
