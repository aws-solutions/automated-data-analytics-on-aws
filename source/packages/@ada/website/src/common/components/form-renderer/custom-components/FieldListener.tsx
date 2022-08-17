/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { get } from 'lodash';
import { isDataEqual } from '$common/utils';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import React, { useEffect, useState } from 'react';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

export interface FieldListenerProps {
  target: string;
  listener: (formApi: ReturnType<typeof useFormApi>, current: any, previous: any) => void;
}

const FieldListenerHandler: React.FC<FieldListenerProps> = ({ listener, target }) => {
  const formApi = useFormApi();
  const currentValue = get(formApi.getState().values, target);

  const [value, setValue] = useState<any>(currentValue);

  const changed = !isDataEqual(currentValue, value);

  useEffect(() => {
    if (changed) {
      listener(formApi, currentValue, value);
      setValue(currentValue);
    }
  }, [changed]);

  return null;
};

export const FieldListener = (props: FieldListenerProps) => {
  return <FormSpy subscription={{ values: true }}>{() => <FieldListenerHandler {...props} />}</FormSpy>;
};
