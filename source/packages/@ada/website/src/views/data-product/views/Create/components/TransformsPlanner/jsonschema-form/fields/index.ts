/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from '@rjsf/core';
import { TransformFields } from '@ada/transforms';
import schemaFieldMapping from './schema-field-mapping';

export const CUSTOM_FIELDS = Object.fromEntries([schemaFieldMapping].map(({ id, field }) => [id, field])) as Record<
  TransformFields,
  Field
>;
