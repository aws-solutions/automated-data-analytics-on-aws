/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomValidatorTypes } from '../validators';
import { Field } from 'aws-northstar/components/FormRenderer';
import { Tag } from '@ada/common';
import { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import { componentTypes, validatorTypes } from 'aws-northstar';
import FieldArray from 'aws-northstar/components/FormRenderer/components/FieldArray';
import React, { FunctionComponent, useMemo } from 'react';

export const TAG_KEY_VALIDATOR: Field['validate'] = [
  {
    type: validatorTypes.REQUIRED,
  },
  {
    type: CustomValidatorTypes.JSONSCHEMA,
    message: 'Must start with letter and only contain letters, numbers, and the following characters _ . : / = + - @',
    schema: Tag.properties!['key'],
  },
];

export const TAG_VALUE_VALIDATOR: Field['validate'] = [
  {
    type: CustomValidatorTypes.JSONSCHEMA,
    message: 'Contain letters, numbers, and the following characters _ . : / = + - @',
    schema: Tag.properties!['value'],
  },
];

export const TagGroup: FunctionComponent<Omit<UseFieldApiConfig, 'fields'>> = (props) => {
  const fieldArrayProps = useMemo<Parameters<typeof FieldArray>[0]>(() => {
    return {
      component: componentTypes.FIELD_ARRAY,
      label: 'Tags',
      name: 'tags',
      minItems: 0,
      maxItems: 100,
      ...props,
      fields: [
        {
          component: componentTypes.TEXT_FIELD,
          name: 'key',
          label: 'Key',
          validate: TAG_KEY_VALIDATOR,
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'value',
          label: 'Value',
          validate: TAG_VALUE_VALIDATOR,
        },
      ],
    };
  }, [props]);

  return <FieldArray {...fieldArrayProps} />;
};

export default TagGroup;
