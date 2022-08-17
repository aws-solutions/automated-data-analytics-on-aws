/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ReservedDomains } from '@ada/common';
import { TransformDefinition } from '../../core';

export const ID = 'ada_json_relationalise';

export const transform: TransformDefinition = {
  namespace: ReservedDomains.GLOBAL,
  id: ID,
  name: 'JSON Relationalize',
  description: 'Relationalizes json for more efficient querying of nested objects',
  helperText: 'https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-crawler-pyspark-transforms-Relationalize.html',
  applicableClassifications: ['json'],
  source: `${__dirname}/json_relationalize_glue.py`,
};
