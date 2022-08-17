/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AutosuggestProps, SelectOption } from 'aws-northstar/components/Autosuggest';
import { FormSpyProps } from 'react-final-form';
import { apiHooks } from '$api';
import { get } from 'lodash';
import { isDataEqual } from '$common/utils';
import { sortApiAccessPolicies } from '$common/entity/api-access-policy';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import React, { useCallback, useMemo } from 'react';
import SelectMapping from 'aws-northstar/components/FormRenderer/components/Select';
import useFieldApi from '@data-driven-forms/react-form-renderer/use-field-api';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

type SelectMappingProps = Parameters<typeof SelectMapping>[0];
export type AccessPolicySelectFieldProps = Omit<SelectMappingProps, 'options' | 'statusType'> & {
  name: string;
};

export const AccessPolicySelectField: React.FC<AccessPolicySelectFieldProps> = (props) => {
  const form = useFormApi();
  const { input } = useFieldApi(props);

  const { multiSelect, freeSolo } = props;

  const [policies, queryInfo] = apiHooks.useApiAccessPolicies();

  const options = useMemo<SelectMappingProps['options']>(() => {
    return sortApiAccessPolicies(policies || []).map((policy) => ({
      label: policy.name,
      value: policy.apiAccessPolicyId,
    }));
  }, [policies]);

  const statusType = useMemo<AutosuggestProps['statusType']>(() => {
    if (queryInfo.isFetched) return 'finished';
    if (queryInfo.isLoading) return 'loading';
    if (queryInfo.error) return 'error';
    return 'finished';
  }, [queryInfo]);

  // unpack value from SelectOption object
  const spyHandler = useCallback<Exclude<FormSpyProps['onChange'], undefined>>(
    (_props) => {
      const value = get(_props.values, input.name);
      let unpackedValue: AccessPolicyValue | AccessPolicyValue[];
      if (multiSelect) {
        unpackedValue = unpackAccessPolicies(value || []);
      } else {
        unpackedValue = value.value || value;
      }

      if (isDataEqual(value, unpackedValue) === false) {
        form.change(input.name, unpackedValue);
      }
    },
    [multiSelect, form, input],
  );

  return (
    <>
      <FormSpy onChange={spyHandler} />

      <SelectMapping
        {...props}
        options={options}
        filteringType={freeSolo ? 'manual' : undefined}
        statusType={statusType}
        stretch={false}
      />
    </>
  );
};

type AccessPolicyValue = string | null;
type AccessPolicyOption = string | SelectOption | undefined | null;

function unpackAccessPolicy(value: AccessPolicyOption): AccessPolicyValue {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.value || null;
}

function unpackAccessPolicies(value: AccessPolicyOption[]): AccessPolicyValue[] {
  return value.map(unpackAccessPolicy);
}
