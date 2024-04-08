/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FormField } from 'aws-northstar';
import { PercentagesSelector } from '$northstar-plus';
import React from 'react';

export const PercentagesSelectorCustomComponent: React.FC<any> = ({
  input,
  ...props
}) => {
  return (<FormField
    {...props}
  >
    <PercentagesSelector
      {...input}
      isReadOnly={(value) => value === 100}
    />
  </FormField>
  )
}