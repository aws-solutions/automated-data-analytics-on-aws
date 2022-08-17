/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AutosuggestProps, SelectOption } from 'aws-northstar/components/Autosuggest';
import { BulkMemberDialog } from './components/BulkUserDialog';
import { Button } from 'aws-northstar';
import { CustomValidatorTypes } from '../../validators';
import { FormSpyProps } from 'react-final-form';
import { ROOT_ADMIN_ID } from '@ada/common';
import { apiHooks } from '$api';
import { compact, get, uniq } from 'lodash';
import { isDataEqual } from '$common/utils';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import React, { useCallback, useMemo, useState } from 'react';
import SelectMapping from 'aws-northstar/components/FormRenderer/components/Select';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

type SelectMappingProps = Parameters<typeof SelectMapping>[0];
export type UserSelectFieldProps = Omit<SelectMappingProps, 'options' | 'statusType'> & {
  name: string;
};

export const UserSelectField: React.FC<UserSelectFieldProps> = (props) => {
  const form = useFormApi();
  const { input } = useFieldApi(props);

  const { multiSelect, freeSolo } = props;

  const [users, queryInfo] = apiHooks.useIdentityUsers(
    {},
    {
      // do not include root admin in list
      select: (_users) => _users.filter((user) => user.preferredUsername !== ROOT_ADMIN_ID),
    },
  );

  const options = useMemo<SelectMappingProps['options']>(() => {
    return (users || []).map((user) => ({
      label: user.preferredUsername,
      value: user.preferredUsername,
    }));
  }, [users]);

  const statusType = useMemo<AutosuggestProps['statusType']>(() => {
    if (queryInfo.isFetched) return 'finished';
    if (queryInfo.isLoading) return 'loading';
    if (queryInfo.error) return 'error';
    return 'finished';
  }, [queryInfo]);

  const validate = useMemo<UseFieldApiConfig['validate']>(() => {
    return [
      {
        type: CustomValidatorTypes.JSONSCHEMA,
        schema: 'USER_IDENTIFIER',
      },
      ...(props.validate || []),
    ];
  }, [props.validate]);

  // unpack value from SelectOption object
  const spyHandler = useCallback<Exclude<FormSpyProps['onChange'], undefined>>(
    (_props) => {
      const value = get(_props.values, input.name);
      let unpackedValue: UserValue | UserValue[];
      if (multiSelect) {
        unpackedValue = unpackUsers(value || []);
      } else {
        unpackedValue = value.value || value;
      }

      if (isDataEqual(value, unpackedValue) === false) {
        form.change(input.name, unpackedValue);
      }
    },
    [multiSelect, form, input],
  );

  const [bulk, setBulk] = useState(false);
  const bulkHandler = useCallback(
    (_users: string[]) => {
      setBulk(false);
      form.change(input.name, uniq(compact(unpackUsers(input.value)).concat(_users)));
    },
    [form, input, setBulk],
  );

  return (
    <>
      <FormSpy onChange={spyHandler} />

      <SelectMapping
        {...props}
        options={options}
        filteringType={freeSolo ? 'manual' : undefined}
        statusType={statusType}
        validate={validate}
        stretch={false}
        secondaryControl={multiSelect ? <Button onClick={() => setBulk(true)}>Bulk</Button> : undefined}
      />

      {multiSelect && bulk && <BulkMemberDialog onClose={() => setBulk(false)} onSave={bulkHandler} />}
    </>
  );
};

type UserValue = string | null;
type UserOption = string | SelectOption | undefined | null;

function unpackUser(value: UserOption): UserValue {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.value || null;
}

function unpackUsers(value: UserOption[]): UserValue[] {
  return value.map(unpackUser);
}
