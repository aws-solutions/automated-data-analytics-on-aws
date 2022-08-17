/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { KeyValuePair, Stack } from 'aws-northstar';
import { StackProps } from 'aws-northstar/layouts/Stack';
import { isEmpty } from 'lodash';
import React from 'react';

interface KeyValuePairStackProps {
  properties?: Record<string, React.ReactNode>;
  spacing?: StackProps['spacing'];
}

export const KeyValuePairStack: React.FC<KeyValuePairStackProps> = ({ properties, spacing }) => {
  if (properties == null || isEmpty(properties)) return null;

  return (
    <Stack spacing={spacing}>
      {Object.entries(properties).map(([label, value], i) => {
        return <KeyValuePair key={i} label={label} value={value} />;
      })}
    </Stack>
  );
};
