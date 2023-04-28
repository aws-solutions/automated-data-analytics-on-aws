/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomValidatorTypes } from '../validators';
import { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import { ValidatorType } from '@data-driven-forms/react-form-renderer';
import React, { FunctionComponent, memo, useMemo } from 'react';
import TextField from 'aws-northstar/components/FormRenderer/components/TextField';

export const EntityIdentifierField: FunctionComponent<UseFieldApiConfig> = (props) => {
  const validate = useMemo<ValidatorType[]>(() => {
    return [
      {
        type: CustomValidatorTypes.JSONSCHEMA,
        schema: 'ID',
        message: 'Must start with letter and only contain lower case letters, numbers, and underscores.',
      },
      ...(props.validate || []),
    ];
  }, [props.validate]);

  return <TextField {...props} validate={validate as any} />;
};

export default memo(EntityIdentifierField);
