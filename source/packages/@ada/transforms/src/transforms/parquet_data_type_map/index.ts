/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ReservedDomains } from '@ada/common';
import { TransformDefinition } from '../../core';

export const ID = 'ada_parquet_data_type_map';

export const transform: TransformDefinition = {
  namespace: ReservedDomains.GLOBAL,
  id: ID,
  name: 'Parquet Data Type Map',
  description: 'Automatically cast unsupported data types to string',
  helperText: 'Columns of type INT64 TIMESTAMP_MICROS in parquet files must be cast to string to be supported',
  applicableClassifications: ['parquet'],
  source: `${__dirname}/parquet_data_type_map.py`,
};
