/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import React from 'react';
import useFieldApi from '@data-driven-forms/react-form-renderer/use-field-api';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

/**
 * Custom component for form renderer that allows wrapping other formrenderer components by passing
 * on the original props
 */
export const CustomWrapper: React.FC<{ name: string }> = (props) => {
  const { CustomComponent, ...rest } = useFieldApi(props);
  const { change } = useFormApi();

  return <CustomComponent {...rest} originalProps={props} changeValue={change} />;
};
