/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FIELD_SELECTOR_HINT, TransformDefinition } from '../../core';
import { JsonSchemaType, ReservedDomains } from '@ada/common';
import { TransformWidgets } from '../../ui';

export const ID = 'ada_drop_fields';

export const transform: TransformDefinition = {
  namespace: ReservedDomains.GLOBAL,
  id: ID,
  name: 'Drop Fields',
  description: 'Drops fields from a data set',
  helperText: 'https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-crawler-pyspark-transforms-DropFields.html',
  source: `${__dirname}/drop_fields.py`,
  inputSchema: {
    type: JsonSchemaType.OBJECT,
    properties: {
      paths: {
        type: JsonSchemaType.ARRAY,
        title: 'Fields to drop',
        description: 'Type or select from the list of fields to drop',
        'ui:widget': TransformWidgets.SCHEMA_FIELD_MULTISELECTOR,
        'ui:help': FIELD_SELECTOR_HINT,
        uniqueItems: true,
        items: {
          type: JsonSchemaType.STRING,
        },
      },
    },
  },
};
