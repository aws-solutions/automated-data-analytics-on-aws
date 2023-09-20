/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as apply_mapping from './apply_mapping';
import * as cw_json_msg_explode from './cloudwatch/json_msg_explode';
import * as drop_fields from './drop_fields';
import * as json_relationalize from './json_relationalize';
import * as parquet_data_type_map from './parquet_data_type_map';
import * as select_fields from './select_fields';
import { AutomaticTransform } from '../core';

export const BuiltInTransforms = {
  [apply_mapping.ID]: apply_mapping.transform,
  [drop_fields.ID]: drop_fields.transform,
  [json_relationalize.ID]: json_relationalize.transform,
  [parquet_data_type_map.ID]: parquet_data_type_map.transform,
  [select_fields.ID]: select_fields.transform,
  [cw_json_msg_explode.ID]: cw_json_msg_explode.transform,
};

/** List of all built-in transform ids */
export type BuiltInTransformIds = keyof typeof BuiltInTransforms;

/**
 * This defines all automatic transforms that can be applied. Transforms are applied in the order they are specified
 * here, filtering out any that do not apply based on the initial classification of data.
 */
export const AUTOMATIC_TRANSFORMS: AutomaticTransform[] = [json_relationalize].map(({ transform }) => ({
  scriptId: transform.id,
  namespace: transform.namespace,
  applicableClassifications: transform.applicableClassifications!,
}));
