/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomComponentTypes } from './custom-components';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import React from 'react';
import TextField from 'aws-northstar/components/FormRenderer/components/TextField';
import snakeCase from 'lodash/snakeCase';

const generateIdentifier = (name?: string) =>
  snakeCase(name || '')
    .toLowerCase()
    .replace(/[^a-z_0-9]/g, '');

export interface MakeNameAndIdentifierFieldsProps {
  identifierFieldName: string;
  entityFriendlyName: string;
  identifierFieldLabel?: string;
  identifierFieldDescription?: string;
  nameFieldName?: string;
  nameFieldLabel?: string;
  nameFieldDescription?: string;
  nameFieldPlaceholder?: string;
}

export const makeNameAndIdentifierFields = (props: MakeNameAndIdentifierFieldsProps): Field[] => [
  {
    component: componentTypes.TEXT_FIELD,
    name: props.nameFieldName || 'name',
    label: props.nameFieldLabel || 'Name',
    description: props.nameFieldDescription || `The name of the new ${props.entityFriendlyName}`,
    placeholder: props.nameFieldPlaceholder || `Enter the name of the ${props.entityFriendlyName}`,
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
    ],
  },
  {
    component: CustomComponentTypes.CUSTOM_WRAPPER,
    name: props.identifierFieldName,
    label: props.identifierFieldLabel || 'Identifier',
    description: props.identifierFieldDescription || `Used to identify this ${props.entityFriendlyName}`,
    CustomComponent: ({ meta, originalProps, changeValue }: any) => (
      <>
        <FormSpy
          subscription={{ values: true }}
          onChange={({ values }) => {
            // If the user hasn't clicked the data product id box yet, we auto-generate an id based on the name
            if (!meta.visited) {
              changeValue(props.identifierFieldName, generateIdentifier(values[props.nameFieldName || 'name']));
            }
          }}
        />
        <TextField {...originalProps} />
      </>
    ),
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
      {
        type: validatorTypes.PATTERN,
        pattern: /^[a-z][a-z_0-9]*$/,
        message: 'Must start with a letter and only contain letters, underscores, and numbers',
      },
      {
        type: validatorTypes.MIN_LENGTH,
        threshold: 1,
      },
      {
        type: validatorTypes.MAX_LENGTH,
        threshold: 30,
      },
    ],
  },
];
