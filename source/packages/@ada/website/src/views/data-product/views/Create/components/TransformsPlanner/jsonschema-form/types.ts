/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field, Widget } from '@rjsf/core';
import { TransformFields, TransformWidgets } from '@ada/transforms';

export interface TransformWidgetDefinition {
  id: TransformWidgets;
  widget: Widget;
}

export interface TransformFieldDefinition {
  id: TransformFields;
  field: Field;
}
