/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FieldSet, TransformPlan } from './types';
import { FormDataSchema } from '../../utils';
import { MergedFieldSet, fieldOptionsFromFieldSet, interpolateFieldEntriesFromPreview } from './utils';
import { SelectOption } from 'aws-northstar/components/Select';
import { Updater, useImmer } from 'use-immer';
import EventEmitter from 'eventemitter3';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface EventTypes {
  SubmitInputArgs: [];
}
type ContextEventEmitter = EventEmitter<EventTypes>;

export interface ITransformPlannerContext {
  sourceSchema: FormDataSchema;
  transformedSchema?: FormDataSchema;
  transformPlan: TransformPlan;
  updateTransformPlan: Updater<TransformPlan>;
  fields: FieldSet;
  addField: (field: string) => void;
  addFields: (fields: string[] | FieldSet) => void;
  emitter: ContextEventEmitter;
}

const TransformPlannerContext = createContext<ITransformPlannerContext | undefined>(undefined);

export const useTransformPlannerContext = () => {
  const context = useContext(TransformPlannerContext);
  if (context == null) throw new Error('Must wrap with <TransformPlannerContext.Provider/> before using context');
  return context;
};

type ProviderProps = Pick<ITransformPlannerContext, 'sourceSchema' | 'transformedSchema'>;

export const TransformPlannerContextProvider: React.FC<ProviderProps> = ({
  children,
  sourceSchema,
  transformedSchema,
}) => {
  const emitter = useMemo(() => {
    return new EventEmitter<EventTypes>();
  }, []);
  const [fields, setFields] = useState<FieldSet>(new Set<string>());
  const [transformPlan, updateTransformPlan] = useImmer<TransformPlan>([]);

  const addFields = useCallback<ITransformPlannerContext['addFields']>((_fields) => {
    setFields((current) => MergedFieldSet(current, _fields));
  }, []);

  const addField = useCallback<ITransformPlannerContext['addField']>(
    (field) => {
      addFields([field]);
    },
    [addFields],
  );

  useEffect(() => {
    sourceSchema.preview && addFields(interpolateFieldEntriesFromPreview(sourceSchema.preview));
  }, [sourceSchema]);

  useEffect(() => {
    transformedSchema?.preview && addFields(interpolateFieldEntriesFromPreview(transformedSchema.preview));
  }, [transformedSchema]);

  const context: ITransformPlannerContext = useMemo(() => ({
    emitter,
    sourceSchema,
    transformedSchema,
    fields,
    addField,
    addFields,
    transformPlan,
    updateTransformPlan,
  }), [
    emitter,
    sourceSchema,
    transformedSchema,
    fields,
    addField,
    addFields,
    transformPlan,
    updateTransformPlan,
  ]);

  return <TransformPlannerContext.Provider value={context}>{children}</TransformPlannerContext.Provider>;
};

export const useFieldOptions = (): SelectOption[] => {
  const { fields } = useTransformPlannerContext();

  return useMemo<SelectOption[]>(() => {
    return fieldOptionsFromFieldSet(fields);
  }, [fields]);
};
