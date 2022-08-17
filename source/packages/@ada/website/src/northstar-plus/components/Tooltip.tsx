/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Popover } from 'aws-northstar';
import { PopoverProps } from 'aws-northstar/components/Popover';
import React from 'react';

export type TooltipProps = PopoverProps;

/**
 * Tooltip component just wraps the northstar Popover with defaults more aligned with standard "hover toolip".
 */
export const Tooltip: React.FC<TooltipProps> = ({ children, ...props }) => {
  return (
    <Popover size="small" variant="hover" showDismissButton={false} {...props}>
      {children}
    </Popover>
  );
};

export default Tooltip;
