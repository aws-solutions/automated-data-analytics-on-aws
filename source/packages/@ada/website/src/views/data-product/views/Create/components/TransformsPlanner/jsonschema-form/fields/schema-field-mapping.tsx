/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Autosuggest, FormField, Inline, Input } from 'aws-northstar';
import { Field } from '@rjsf/core';
import { FieldMappingSchema, TransformFields } from '@ada/transforms';
import { GlueDataTypes } from '@ada/common';
import { TransformFieldDefinition } from '../types';
import { isEmpty, omitBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useFieldOptions, useTransformPlannerContext } from '../../context';
import { useStatefulRef } from '$common/hooks';
import { v4 as uuid } from 'uuid';
import Select, { SelectOption } from 'aws-northstar/components/Select';

export const SchemaFieldMappingField: Field = (props) => {
  const id = useMemo<string>(() => {
    return props.itemID || props.id || uuid();
  }, [(props.itemID, props.id)]);
  const { emitter, addField } = useTransformPlannerContext();
  const fieldOptions = useFieldOptions();
  const dataTypeOptions = useMemo<SelectOption[]>(() => {
    return Object.values(GlueDataTypes).map((dataType) => ({
      label: dataType,
      value: dataType,
    }));
  }, []);

  const [oldName, setOldName] = useState<FieldMappingSchema['oldName'] | undefined>(props.formData?.oldName);
  const [newName, setNewName] = useState<FieldMappingSchema['newName'] | undefined>(props.formData?.newName);
  const [newType, setNewType] = useState<FieldMappingSchema['newType'] | undefined>(props.formData?.newType);
  const value = useMemo<Partial<FieldMappingSchema>>(() => {
    return {
      oldName,
      newName,
      newType,
    };
  }, [oldName, newName, newType]);
  const valueRef = useStatefulRef(value);

  useEffect(() => {
    if (!isEmpty(omitBy(value, isEmpty))) {
      props.onChange(value);
    }
  }, [value, props.onChange]);

  useEffect(() => {
    const listener = () => {
      const { newName: _newName } = valueRef.current as FieldMappingSchema;
      addField(_newName);
    };
    emitter.on('SubmitInputArgs', listener);

    return () => {
      emitter.off('SubmitInputArgs', listener);
    };
  }, [valueRef, addField]);

  return (
    <Inline>
      {/** @ts-ignore Legacy Code*/}
      <FormField label="Old name" controlId={id + 'oldName'} stretch css={{ width: '30%' }}>
        <Autosuggest
          controlId={id + 'oldName'}
          filteringType="manual"
          freeSolo={true}
          options={fieldOptions}
          onChange={(selection) => setOldName(selection?.value)}
          onInputChange={(_event, _value) => setOldName(_value)}
          value={fieldOptions.find((option) => option.value === oldName)}
        />
      </FormField>
      {/** @ts-ignore Legacy Code*/}
      <FormField label="New name" controlId={id + 'newName'} stretch css={{ width: '30%' }}>
        <Input controlId={id + 'newName'} onChange={setNewName} value={newName} />
      </FormField>
      {/** @ts-ignore Legacy Code*/}
      <FormField label="New type" controlId={id + 'newType'} stretch css={{ width: '30%' }}>
        <Select
          controlId={id + 'newType'}
          options={dataTypeOptions}
          onChange={(event) => setNewType(event.target.value as string)}
          selectedOption={dataTypeOptions.find((option) => option.value === newType)}
        />
      </FormField>
    </Inline>
  );
};

export default {
  id: TransformFields.SCHEMA_FIELD_MAPPING,
  field: SchemaFieldMappingField,
} as TransformFieldDefinition;
