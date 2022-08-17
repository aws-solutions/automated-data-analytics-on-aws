/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TransformWidgets } from '@ada/transforms';
import { Widget } from '@rjsf/core';
import schemaFieldMultiselector from './schema-field-multiselector';
import schemaFieldSelector from './schema-field-selector';

export const CUSTOM_WIDGETS = Object.fromEntries(
  [schemaFieldSelector, schemaFieldMultiselector].map(({ id, widget }) => [id, widget]),
) as Record<TransformWidgets, Widget>;
