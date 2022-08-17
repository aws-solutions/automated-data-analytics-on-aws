/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CUSTOMER_VALIDATOR_MAPPER } from './validators';
import { DEFAULT_CUSTOM_COMPONENT_WRAPPER } from './custom-components';
import { FormRenderer as FormRendererBase } from 'aws-northstar';
import { FormRendererProps } from 'aws-northstar/components/FormRenderer';
import React from 'react';

export const FormRenderer: React.FC<FormRendererProps> = (props) => {
  return (
    <FormRendererBase
      {...props}
      customComponentWrapper={{ ...DEFAULT_CUSTOM_COMPONENT_WRAPPER, ...props.customComponentWrapper }}
      validatorMapper={{ ...CUSTOMER_VALIDATOR_MAPPER, ...props.validatorMapper }}
    />
  );
};
