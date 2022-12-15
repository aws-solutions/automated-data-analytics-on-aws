/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchemaType, ReservedDomains } from '@ada/common';
import { TransformDefinition } from '../../../core';

export const ID = 'cw_json_msg_explode';

export const transform: TransformDefinition = {
  namespace: ReservedDomains.GLOBAL,
  id: ID,
  name: 'Cloudwatch JSON explode',
  description: 'Explode nested json for cloudwatch logs',
  source: `${__dirname}/json_msg_explode.py`,
  inputSchema: {
    type: JsonSchemaType.OBJECT,
    'ui:order': ['drop_threshold', 'extraction_str'],
    required: ['drop_threshold', 'extraction_str'],
    properties: {
      drop_threshold: {
        type: JsonSchemaType.NUMBER,
        title: 'Column null drop threshold',
        description: 'Drop columns that have a percentage of null values above this threshold.',
        default: 90,
        'ui:description': 'Drop columns that have a percentage of null values above this threshold.',
      },
      extraction_str: {
        type: JsonSchemaType.STRING,
        title: 'Regex to Extract embedded json',
        description: 'The regex pattern used to extract the json substring in message field.',
        default: '^.+\t({.+})$',
        'ui:description': 'The regex pattern used to extract the json substring in message field.',
      },
    },
  },
};
