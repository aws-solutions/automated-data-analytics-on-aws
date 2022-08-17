/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomValidatorTypes } from '../validators';
import { Field } from 'aws-northstar/components/FormRenderer';
import { ValidatorType } from '@data-driven-forms/react-form-renderer';
import { isEmpty } from 'lodash';
import { nameToIdentifier } from '$common/utils';
import React, { FunctionComponent, memo, useCallback, useEffect, useMemo, useState } from 'react';
import TextField from 'aws-northstar/components/FormRenderer/components/TextField';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

export const EntityNameFieldResolveProps: Field['resolveProps'] = (_props, { input }) => {
  return {
    helperText: renderHelperText(input.value),
  };
};

function renderHelperText(value?: string): React.ReactNode {
  if (value == null || isEmpty(value))
    return (
      <span>
        <b>-</b>
      </span>
    );
  return (
    <span>
      <b>Identifier:</b> <i>{nameToIdentifier(value)}</i>
    </span>
  );
}

export const EntityNameField: FunctionComponent<UseFieldApiConfig> = (props) => {
  const form = useFormApi();
  const { input } = useFieldApi(props);

  const validate = useMemo<ValidatorType[]>(() => {
    return [
      {
        type: CustomValidatorTypes.JSONSCHEMA,
        schema: 'NAME',
      },
      ...(props.validate || []),
    ];
  }, [props.validate]);

  const [helperText, setHelperText] = useState<React.ReactNode>(renderHelperText(props.value));

  useEffect(() => {
    setHelperText(renderHelperText(input.value));
  }, [input.value]);

  const changeHandler = useCallback(
    (value) => {
      form.change(input.name, value);
    },
    [form, input],
  );

  return <TextField {...props} validate={validate} onChange={changeHandler} helperText={helperText} />;
};

export default memo(EntityNameField);
