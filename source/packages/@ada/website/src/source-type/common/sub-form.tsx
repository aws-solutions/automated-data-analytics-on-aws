/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition } from '@ada/common';
import { Field, componentTypes } from 'aws-northstar/components/FormRenderer';
import { LL } from '$strings';
import { generateDataUpdateFields } from './update-trigger';

export function sourceTypeSubForm(
  source: DataProductSourceDefinition,
  fields: Field[],
  additionalDataUpdateFields?: Field[],
): Field[] {
  return [
    {
      component: componentTypes.SUB_FORM,
      title: LL.ENTITY.DataProduct_.SourceType[source.TYPE].label(),
      description: LL.ENTITY.DataProduct_.SourceType[source.TYPE].description(),
      name: `__${source.TYPE}__details`,
      condition: {
        when: 'sourceType',
        is: source.TYPE,
      },
      fields,
    },
    ...generateDataUpdateFields(source, additionalDataUpdateFields),
  ];
}
