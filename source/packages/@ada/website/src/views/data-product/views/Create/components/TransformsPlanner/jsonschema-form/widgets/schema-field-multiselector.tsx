/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FormField, Multiselect } from 'aws-northstar';
import { MultiselectProps, SelectOption } from 'aws-northstar/components/Autosuggest';
import { TransformWidgetDefinition } from '../types';
import { TransformWidgets } from '@ada/transforms';
import { Widget } from '@rjsf/core';
import { useCallback, useState } from 'react';
import { useFieldOptions } from '../../context';

export const SchemaFieldMultiselectorWidget: Widget = (props) => {
  const options = useFieldOptions();
  const [value, setValue] = useState<SelectOption[]>(() => {
    return (props.value || []).map((_value: string): SelectOption => {
      const _option = options.find((option) => option.value === _value);
      if (_option) return _option;
      return {
        label: _value,
        value: _value,
      };
    });
  });

  const onChange = useCallback<Required<MultiselectProps>['onChange']>(
    (values) => {
      props.onChange(values.map((option) => option.value));
      setValue(values);
    },
    [props.onChange],
  );

  return (
    <FormField controlId={props.id} label={props.label} stretch>
      <Multiselect
        controlId={props.id}
        options={options}
        ariaDescribedby={props['aria-describedby'] || props.det}
        value={value}
        onChange={onChange}
        freeSolo
      />
    </FormField>
  );
};

export default {
  id: TransformWidgets.SCHEMA_FIELD_MULTISELECTOR,
  widget: SchemaFieldMultiselectorWidget,
} as TransformWidgetDefinition;
