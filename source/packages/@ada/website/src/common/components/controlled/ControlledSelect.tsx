/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Select } from 'aws-northstar';
import { SelectOption } from 'aws-northstar/components/Select';
import React, { useState } from 'react';

export interface ControlledSelectProps {
  selectedOption: SelectOption;
  options: SelectOption[];
  onChange: (value: string) => void;
}

/**
 * Select component with its own controlled state
 */
export const ControlledSelect: React.FC<ControlledSelectProps> = ({ selectedOption, options, onChange }) => {
  const [option, setOption] = useState(selectedOption);

  return (
    <Select
      selectedOption={option}
      options={options}
      onChange={(e) => {
        setOption(options.find((o) => o.value === e.target.value)!);
        onChange(e.target.value as string);
      }}
    />
  );
};
