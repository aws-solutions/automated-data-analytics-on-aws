/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Textarea } from 'aws-northstar';
import React, { useState } from 'react';

interface ControlledTextareaProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Text area with its own controlled state
 */
export const ControlledTextarea: React.FC<ControlledTextareaProps> = ({ value, onChange }) => {
  const [text, setText] = useState<string>(value || '');

  return <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text)} />;
};
