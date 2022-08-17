/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Autosuggest, FormField } from 'aws-northstar';
import { TransformWidgetDefinition } from '../types';
import { TransformWidgets } from '@ada/transforms';
import { Widget } from '@rjsf/core';
import { useFieldOptions } from '../../context';

export const SchemaFieldSelectorWidget: Widget = (props) => {
  const options = useFieldOptions();

  return (
    <FormField controlId={props.id} label={props.label} stretch>
      <Autosuggest
        controlId={props.id}
        filteringType="manual"
        options={options}
        ariaDescribedby={props['aria-describedby'] || props.det}
        onChange={(selection) => props.onChange(selection?.value)}
        value={options.find((option) => option.value === props.value)}
        freeSolo
      />
    </FormField>
  );
};

export default {
  id: TransformWidgets.SCHEMA_FIELD_SELECTOR,
  widget: SchemaFieldSelectorWidget,
} as TransformWidgetDefinition;
